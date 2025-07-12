const { verifyRefreshToken } = require('./jwt');
const User = require('../models/User');

// Cleanup expired refresh tokens for a specific user
const cleanupUserRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return 0;

    const validTokens = [];
    let expiredCount = 0;

    for (const tokenObj of user.refreshTokens) {
      try {
        // Try to verify the token
        verifyRefreshToken(tokenObj.token);
        validTokens.push(tokenObj);
      } catch (error) {
        // Token is expired or invalid
        expiredCount++;
        console.log(`🗑️ Removing expired refresh token for user ${userId}`);
      }
    }

    // Update user with only valid tokens
    if (expiredCount > 0) {
      user.refreshTokens = validTokens;
      await user.save();
      console.log(`✅ Cleaned ${expiredCount} expired tokens for user ${userId}`);
    }

    return expiredCount;
  } catch (error) {
    console.error(`❌ Error cleaning tokens for user ${userId}:`, error);
    return 0;
  }
};

// Cleanup expired refresh tokens for all users
const cleanupAllExpiredTokens = async () => {
  try {
    console.log('🧹 Starting global refresh token cleanup...');
    
    const users = await User.find({ 
      refreshTokens: { $exists: true, $not: { $size: 0 } } 
    });

    let totalCleaned = 0;
    let usersProcessed = 0;

    for (const user of users) {
      const cleaned = await cleanupUserRefreshTokens(user._id);
      totalCleaned += cleaned;
      usersProcessed++;
    }

    console.log(`✅ Cleanup completed: ${totalCleaned} tokens removed from ${usersProcessed} users`);
    return { totalCleaned, usersProcessed };
    
  } catch (error) {
    console.error('❌ Global cleanup failed:', error);
    return { totalCleaned: 0, usersProcessed: 0 };
  }
};

// Cleanup tokens older than specified days (regardless of expiry)
const cleanupOldTokens = async (olderThanDays = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    console.log(`🧹 Cleaning tokens older than ${olderThanDays} days (before ${cutoffDate.toISOString()})`);

    const result = await User.updateMany(
      { "refreshTokens.createdAt": { $lt: cutoffDate } },
      {
        $pull: {
          refreshTokens: {
            createdAt: { $lt: cutoffDate }
          }
        }
      }
    );

    console.log(`✅ Cleaned old tokens: ${result.modifiedCount} users affected`);
    return result.modifiedCount;

  } catch (error) {
    console.error('❌ Old token cleanup failed:', error);
    return 0;
  }
};

// Middleware to cleanup user's tokens on each authenticated request
const autoCleanupMiddleware = async (req, res, next) => {
  if (req.user && req.user._id) {
    // Cleanup expired tokens for current user (async, don't wait)
    cleanupUserRefreshTokens(req.user._id).catch(err => {
      console.error('Auto cleanup failed:', err);
    });
  }
  next();
};

// Scheduled cleanup (to be called periodically)
const scheduleCleanup = (intervalHours = 24) => {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  
  console.log(`⏰ Scheduling refresh token cleanup every ${intervalHours} hours`);
  
  // Initial cleanup
  setTimeout(cleanupAllExpiredTokens, 60000); // Start after 1 minute
  
  // Periodic cleanup
  setInterval(async () => {
    await cleanupAllExpiredTokens();
    await cleanupOldTokens(30); // Remove tokens older than 30 days
  }, intervalMs);
};

// Get cleanup statistics
const getCleanupStats = async () => {
  try {
    const users = await User.find({ 
      refreshTokens: { $exists: true, $not: { $size: 0 } } 
    });

    let totalTokens = 0;
    let expiredTokens = 0;
    let validTokens = 0;

    for (const user of users) {
      for (const tokenObj of user.refreshTokens) {
        totalTokens++;
        try {
          verifyRefreshToken(tokenObj.token);
          validTokens++;
        } catch (error) {
          expiredTokens++;
        }
      }
    }

    return {
      totalUsers: users.length,
      totalTokens,
      validTokens,
      expiredTokens,
      cleanupNeeded: expiredTokens > 0
    };

  } catch (error) {
    console.error('❌ Error getting cleanup stats:', error);
    return null;
  }
};

module.exports = {
  cleanupUserRefreshTokens,
  cleanupAllExpiredTokens,
  cleanupOldTokens,
  autoCleanupMiddleware,
  scheduleCleanup,
  getCleanupStats
};
