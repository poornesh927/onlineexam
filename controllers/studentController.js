const User = require('../models/User');
const Attempt = require('../models/Attempt');
const Exam = require('../models/Exam');

// @desc Student dashboard stats
// @route GET /api/student/dashboard
const getDashboard = async (req, res) => {
  try {
    const [attempts, totalExams] = await Promise.all([
      Attempt.find({ student: req.userId, status: { $in: ['submitted', 'auto-submitted'] } })
        .populate('exam', 'title category totalMarks')
        .sort({ submittedAt: -1 }),
      Exam.countDocuments({ isPublished: true, isActive: true }),
    ]);

    const totalAttempts = attempts.length;
    const passedCount = attempts.filter(a => a.isPassed).length;
    const avgScore = totalAttempts > 0 
      ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / totalAttempts) 
      : 0;
    const bestScore = totalAttempts > 0 ? Math.max(...attempts.map(a => a.percentage)) : 0;

    // Recent performance (last 5)
    const recentAttempts = attempts.slice(0, 5).map(a => ({
      _id: a._id,
      examTitle: a.exam?.title,
      category: a.exam?.category,
      marksObtained: a.marksObtained,
      totalMarks: a.totalMarks,
      percentage: a.percentage,
      isPassed: a.isPassed,
      rank: a.rank,
      submittedAt: a.submittedAt,
    }));

    // Performance by category
    const categoryStats = {};
    attempts.forEach(a => {
      const cat = a.exam?.category || 'General';
      if (!categoryStats[cat]) categoryStats[cat] = { count: 0, total: 0 };
      categoryStats[cat].count++;
      categoryStats[cat].total += a.percentage;
    });
    const categoryPerformance = Object.entries(categoryStats).map(([cat, stats]) => ({
      category: cat,
      attempts: stats.count,
      avgScore: Math.round(stats.total / stats.count),
    }));

    res.json({
      success: true,
      data: {
        stats: { totalAttempts, passedCount, avgScore, bestScore, totalExams },
        recentAttempts,
        categoryPerformance,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get student profile
// @route GET /api/student/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update student profile
// @route PUT /api/student/profile
const updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId, { name, avatar }, { new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Profile updated.', data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboard, getProfile, updateProfile };
