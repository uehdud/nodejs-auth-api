const express = require("express");
const passport = require("passport");
const User = require("../models/User");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");

const router = express.Router();

// @route   GET /auth/google
// @desc    Google OAuth login
// @access  Public
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// @route   GET /auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?error=google_auth_failed",
    session: false,
  }),
  async (req, res) => {
    try {
      const user = req.user;

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user._id,
        email: user.email,
        role: user.role,
      });
      const refreshToken = generateRefreshToken({ id: user._id });

      // Save refresh token to user
      await user.addRefreshToken(refreshToken);

      // Redirect to result page with tokens
      res.redirect(
        `/auth/google/result?token=${accessToken}&refresh=${refreshToken}`
      );
    } catch (error) {
      console.error("Google callback error:", error);
      res.redirect("/login?error=auth_failed");
    }
  }
);

// @route   GET /auth/success
// @desc    Handle successful Google auth redirect
// @access  Public
router.get("/success", async (req, res) => {
  try {
    const { token, refresh } = req.query;

    if (!token || !refresh) {
      return res.status(400).json({
        success: false,
        message: "Missing authentication tokens",
      });
    }

    // Verify the access token to get user info
    const decoded = require("../utils/jwt").verifyAccessToken(token);
    const user = await User.findById(decoded.id).select(
      "-password -refreshTokens"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Return success response with tokens and user info
    res.json({
      success: true,
      message: "Google authentication successful",
      data: {
        user,
        accessToken: token,
        refreshToken: refresh,
      },
    });
  } catch (error) {
    console.error("Auth success error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid authentication tokens",
    });
  }
});

// @route   GET /auth/google/success
// @desc    Get tokens after successful Google auth (alternative approach)
// @access  Public
router.post("/google/success", async (req, res) => {
  try {
    const { googleId } = req.body;

    if (!googleId) {
      return res.status(400).json({
        success: false,
        message: "Google ID required",
      });
    }

    const user = await User.findOne({ googleId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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

    res.json({
      success: true,
      message: "Google authentication successful",
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Google success error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /auth/google/result
// @desc    Display Google auth result page
// @access  Public
router.get("/google/result", (req, res) => {
  const { token, refresh, error } = req.query;

  if (error) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1 class="error">Authentication Failed</h1>
        <p>Google authentication failed. Please try again.</p>
        <button onclick="window.close()">Close Window</button>
      </body>
      </html>
    `);
  }

  if (token && refresh) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #2e7d32; }
          .token-box { 
            background: #f5f5f5; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            word-break: break-all;
            max-height: 200px;
            overflow-y: auto;
          }
          button { 
            background: #1976d2; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 4px; 
            cursor: pointer; 
            margin: 5px;
          }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Authentication Successful!</h1>
        <p>You have successfully authenticated with Google.</p>
        
        <h3>Access Token:</h3>
        <div class="token-box" id="accessToken">${token}</div>
        
        <h3>Refresh Token:</h3>
        <div class="token-box" id="refreshToken">${refresh}</div>
        
        <button onclick="copyToken('accessToken')">Copy Access Token</button>
        <button onclick="copyToken('refreshToken')">Copy Refresh Token</button>
        <button onclick="window.close()">Close Window</button>
        
        <script>
          function copyToken(elementId) {
            const element = document.getElementById(elementId);
            const text = element.textContent;
            navigator.clipboard.writeText(text).then(() => {
              alert('Token copied to clipboard!');
            });
          }
          
          // Auto-close after 30 seconds
          setTimeout(() => {
            if (confirm('Close this window?')) {
              window.close();
            }
          }, 30000);
        </script>
      </body>
      </html>
    `);
  }

  res.status(400).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Error</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
      </style>
    </head>
    <body>
      <h1 class="error">Authentication Error</h1>
      <p>Missing authentication tokens.</p>
      <button onclick="window.close()">Close Window</button>
    </body>
    </html>
  `);
});

module.exports = router;
