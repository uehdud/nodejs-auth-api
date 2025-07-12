const express = require("express");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { auth } = require("../middleware/auth");
const { logActivity, activityLogger } = require("../utils/activityLogger");

const router = express.Router();

// @route   POST /auth/register
// @desc    Register new user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role === "admin" ? "admin" : "user", // Only allow admin if explicitly set
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({ id: user._id });

    // Save refresh token to user
    await user.addRefreshToken(refreshToken);

    // Log login activity
    await logActivity(user._id, "login", req, true, {
      loginMethod: "email_password",
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   POST /auth/login
// @desc    Login user
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({ id: user._id });

    // Save refresh token to user
    await user.addRefreshToken(refreshToken);

    // Log login activity
    await logActivity(user._id, "login", req, true, {
      loginMethod: "email_password",
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /auth/me
// @desc    Get current user
// @access  Private
router.get("/me", auth, activityLogger("profile_access"), async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /auth/me-query
// @desc    Get current user (alternative with query parameter support)
// @access  Public (token via query param)
router.get("/me-query", async (req, res) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided in query parameter.",
      });
    }

    const { verifyAccessToken } = require("../utils/jwt");
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select(
      "-password -refreshTokens"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    res.json({
      success: true,
      data: {
        user: user,
      },
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired.",
      });
    }

    console.error("Auth me-query error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   POST /auth/refresh
// @desc    Refresh access token
// @access  Public
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Find user and check if refresh token exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const tokenExists = user.refreshTokens.some(
      (t) => t.token === refreshToken
    );
    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   POST /auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", auth, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Remove specific refresh token
      await req.user.removeRefreshToken(refreshToken);
      console.log(`🗑️ Removed specific refresh token for user ${req.user._id}`);
    } else {
      // If no refresh token provided, remove all refresh tokens (logout all)
      req.user.refreshTokens = [];
      await req.user.save();
      console.log(`🗑️ Removed ALL refresh tokens for user ${req.user._id}`);
    }

    // Log logout activity
    await logActivity(req.user._id, "logout", req, true, {
      logoutType: refreshToken ? "single_device" : "all_devices",
      tokenProvided: !!refreshToken
    });

    res.json({
      success: true,
      message: refreshToken ? "Logout successful" : "Logged out from all devices",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   POST /auth/logout-all
// @desc    Logout from all devices
// @access  Private
router.post("/logout-all", auth, async (req, res) => {
  try {
    // Clear all refresh tokens
    req.user.refreshTokens = [];
    await req.user.save();

    // Log logout all activity
    await logActivity(req.user._id, "logout_all", req, true, {
      logoutType: "all_devices",
    });

    res.json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    console.error("Logout all error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   POST /auth/cleanup-tokens
// @desc    Manual cleanup expired refresh tokens
// @access  Private (Admin or self)
router.post("/cleanup-tokens", auth, async (req, res) => {
  try {
    const { userId, scope } = req.body;
    const { cleanupUserRefreshTokens, cleanupAllExpiredTokens, cleanupOldTokens } = require('../utils/tokenCleanup');
    
    let result = {};
    
    if (scope === 'all' && req.user.role === 'admin') {
      // Admin can cleanup all users
      const globalResult = await cleanupAllExpiredTokens();
      const oldTokensResult = await cleanupOldTokens(30);
      
      result = {
        scope: 'global',
        expiredTokensCleaned: globalResult.totalCleaned,
        usersProcessed: globalResult.usersProcessed,
        oldTokensCleaned: oldTokensResult
      };
      
    } else if (userId && req.user.role === 'admin') {
      // Admin can cleanup specific user
      const cleaned = await cleanupUserRefreshTokens(userId);
      result = {
        scope: 'user',
        userId,
        tokensCleaned: cleaned
      };
      
    } else {
      // User can only cleanup their own tokens
      const cleaned = await cleanupUserRefreshTokens(req.user._id);
      result = {
        scope: 'self',
        userId: req.user._id,
        tokensCleaned: cleaned
      };
    }
    
    // Log cleanup activity
    await logActivity(req.user._id, 'token_cleanup', req, true, result);
    
    res.json({
      success: true,
      message: 'Token cleanup completed',
      data: result
    });
    
  } catch (error) {
    console.error("Cleanup tokens error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /auth/token-stats
// @desc    Get refresh token statistics
// @access  Private (Admin or self)
router.get("/token-stats", auth, async (req, res) => {
  try {
    const { getCleanupStats } = require('../utils/tokenCleanup');
    
    if (req.user.role === 'admin') {
      // Admin gets global stats
      const globalStats = await getCleanupStats();
      
      res.json({
        success: true,
        data: {
          scope: 'global',
          ...globalStats
        }
      });
      
    } else {
      // User gets their own stats
      const user = await User.findById(req.user._id);
      const { verifyRefreshToken } = require('../utils/jwt');
      
      let validTokens = 0;
      let expiredTokens = 0;
      
      for (const tokenObj of user.refreshTokens) {
        try {
          verifyRefreshToken(tokenObj.token);
          validTokens++;
        } catch (error) {
          expiredTokens++;
        }
      }
      
      res.json({
        success: true,
        data: {
          scope: 'self',
          userId: req.user._id,
          totalTokens: user.refreshTokens.length,
          validTokens,
          expiredTokens,
          cleanupNeeded: expiredTokens > 0
        }
      });
    }
    
  } catch (error) {
    console.error("Get token stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   POST /auth/clear-tokens
// @desc    Force clear all refresh tokens (admin or self)
// @access  Private
router.post("/clear-tokens", auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    // Allow admin to clear any user's tokens, or user to clear their own
    if (userId && req.user.role !== 'admin' && userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to clear other user's tokens"
      });
    }
    
    const targetUserId = userId || req.user._id;
    const user = await User.findById(targetUserId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    const tokenCount = user.refreshTokens.length;
    user.refreshTokens = [];
    await user.save();
    
    // Log activity
    await logActivity(req.user._id, 'logout_all', req, true, {
      logoutType: 'force_clear',
      targetUserId,
      tokensCleared: tokenCount
    });
    
    res.json({
      success: true,
      message: `Cleared ${tokenCount} refresh tokens`,
      data: {
        userId: targetUserId,
        tokensCleared: tokenCount
      }
    });
    
  } catch (error) {
    console.error("Clear tokens error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /auth/tokens
// @desc    Get current user's refresh tokens (for debugging)
// @access  Private
router.get("/tokens", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        userId: user._id,
        totalRefreshTokens: user.refreshTokens.length,
        tokens: user.refreshTokens.map(t => ({
          id: t._id,
          createdAt: t.createdAt,
          tokenPreview: t.token.substring(0, 20) + "..."
        }))
      }
    });
  } catch (error) {
    console.error("Get tokens error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
