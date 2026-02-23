const Exam = require('../models/Exam');
const Attempt = require('../models/Attempt');

// @desc Get all published exams
// @route GET /api/exams
const getExams = async (req, res) => {
  try {
    const now = new Date();
    const query = { isPublished: true, isActive: true };
    
    const exams = await Exam.find(query)
      .select('-questions.options.isCorrect -questions.explanation')
      .populate('createdBy', 'name')
      .sort({ startTime: 1 });

    // Add attempt count for each exam
    const examIds = exams.map(e => e._id);
    const attemptCounts = await Attempt.aggregate([
      { $match: { exam: { $in: examIds }, student: req.userId } },
      { $group: { _id: '$exam', count: { $sum: 1 } } }
    ]);
    const attemptMap = {};
    attemptCounts.forEach(a => { attemptMap[a._id.toString()] = a.count; });

    const enriched = exams.map(exam => ({
      ...exam.toObject(),
      userAttempts: attemptMap[exam._id.toString()] || 0,
      status: now < exam.startTime ? 'upcoming' : now > exam.endTime ? 'expired' : 'active',
      questionCount: exam.questions.length,
    }));

    res.json({ success: true, data: { exams: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single exam details (without correct answers)
// @route GET /api/exams/:id
const getExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .select('-questions.options.isCorrect -questions.explanation')
      .populate('createdBy', 'name');

    if (!exam || !exam.isPublished) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    const userAttempts = await Attempt.countDocuments({ exam: exam._id, student: req.userId });
    
    res.json({ 
      success: true, 
      data: { 
        exam: { ...exam.toObject(), questionCount: exam.questions.length },
        userAttempts 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getExams, getExam };
