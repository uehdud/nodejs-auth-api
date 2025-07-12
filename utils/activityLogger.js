const ActivityLog = require("../models/ActivityLog");

// Helper function untuk log aktivitas user
const logActivity = async (
  userId,
  action,
  req,
  success = true,
  details = null
) => {
  try {
    const ipAddress =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null);

    const userAgent = req.get("User-Agent");

    await ActivityLog.create({
      userId,
      action,
      ipAddress,
      userAgent,
      success,
      details,
    });

    console.log(`📝 Activity logged: ${action} for user ${userId}`);
  } catch (error) {
    console.error("❌ Failed to log activity:", error);
    // Don't throw error to avoid breaking main functionality
  }
};

// Middleware untuk auto-log aktivitas
const activityLogger = (action) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;

    res.json = function (data) {
      // Log activity after successful response
      if (req.user && res.statusCode < 400) {
        logActivity(req.user._id, action, req, true, {
          statusCode: res.statusCode,
          responseData: data,
        });
      }

      // Call original res.json
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  logActivity,
  activityLogger,
};
