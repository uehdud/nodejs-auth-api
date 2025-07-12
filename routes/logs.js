const express = require("express");
const ActivityLog = require("../models/ActivityLog");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

// @route   GET /logs/my-activity
// @desc    Get current user's activity logs
// @access  Private
router.get("/my-activity", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ActivityLog.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get my activity error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /logs/all-activity
// @desc    Get all users activity logs (admin only)
// @access  Private (Admin)
router.get("/all-activity", auth, adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const action = req.query.action;
    const userId = req.query.userId;

    // Build filter
    const filter = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;

    const logs = await ActivityLog.find(filter)
      .populate("userId", "name email role")
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ActivityLog.countDocuments(filter);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        filters: {
          action,
          userId,
        },
      },
    });
  } catch (error) {
    console.error("Get all activity error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /logs/stats
// @desc    Get activity statistics (admin only)
// @access  Private (Admin)
router.get("/stats", auth, adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = await Promise.all([
      // Today's activities
      ActivityLog.countDocuments({
        timestamp: { $gte: today },
      }),

      // This week's activities
      ActivityLog.countDocuments({
        timestamp: { $gte: thisWeek },
      }),

      // This month's activities
      ActivityLog.countDocuments({
        timestamp: { $gte: thisMonth },
      }),

      // Activities by action type
      ActivityLog.aggregate([
        {
          $group: {
            _id: "$action",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]),

      // Most active users (this month)
      ActivityLog.aggregate([
        {
          $match: {
            timestamp: { $gte: thisMonth },
          },
        },
        {
          $group: {
            _id: "$userId",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $project: {
            count: 1,
            "user.name": 1,
            "user.email": 1,
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        today: stats[0],
        thisWeek: stats[1],
        thisMonth: stats[2],
        byAction: stats[3],
        mostActiveUsers: stats[4],
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
