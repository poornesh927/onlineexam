const Exam = require('../models/Exam');
const User = require('../models/User');
const Attempt = require('../models/Attempt');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

// @desc Admin dashboard stats
// @route GET /api/admin/dashboard
const getDashboard = async (req, res) => {
  try {
    const [totalStudents, totalExams, totalAttempts, recentAttempts] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Exam.countDocuments({ isActive: true }),
      Attempt.countDocuments({ status: { $in: ['submitted', 'auto-submitted'] } }),
      Attempt.find({ status: { $in: ['submitted', 'auto-submitted'] } })
        .populate('student', 'name email')
        .populate('exam', 'title')
        .sort({ submittedAt: -1 })
        .limit(10),
    ]);

    // Monthly attempt stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyStats = await Attempt.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { 
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        count: { $sum: 1 },
        avgScore: { $avg: '$percentage' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Pass rate
    const passedCount = await Attempt.countDocuments({ 
      status: { $in: ['submitted', 'auto-submitted'] }, isPassed: true 
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalExams,
          totalAttempts,
          passRate: totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0,
        },
        recentAttempts,
        monthlyStats,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create exam
// @route POST /api/admin/exams
const createExam = async (req, res) => {
  try {
    const examData = { ...req.body, createdBy: req.userId };
    const exam = await Exam.create(examData);
    res.status(201).json({ success: true, message: 'Exam created.', data: { exam } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all exams (admin)
// @route GET /api/admin/exams
const getAdminExams = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Exam.countDocuments();
    const exams = await Exam.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Add attempt counts
    const examIds = exams.map(e => e._id);
    const attemptCounts = await Attempt.aggregate([
      { $match: { exam: { $in: examIds } } },
      { $group: { _id: '$exam', count: { $sum: 1 }, avgScore: { $avg: '$percentage' } } }
    ]);
    const countMap = {};
    attemptCounts.forEach(a => { countMap[a._id.toString()] = { count: a.count, avgScore: a.avgScore }; });

    const enriched = exams.map(exam => ({
      ...exam.toObject(),
      questionCount: exam.questions.length,
      attemptCount: countMap[exam._id.toString()]?.count || 0,
      avgScore: Math.round(countMap[exam._id.toString()]?.avgScore || 0),
    }));

    res.json({ success: true, data: { exams: enriched, pagination: { page, limit, total } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get single exam (admin - with answers)
// @route GET /api/admin/exams/:id
const getAdminExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('createdBy', 'name');
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });
    res.json({ success: true, data: { exam } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update exam
// @route PUT /api/admin/exams/:id
const updateExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });
    res.json({ success: true, message: 'Exam updated.', data: { exam } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Delete exam
// @route DELETE /api/admin/exams/:id
const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });
    await Attempt.deleteMany({ exam: req.params.id });
    res.json({ success: true, message: 'Exam deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Import questions via CSV
// @route POST /api/admin/exams/:id/import-questions
const importQuestions = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const csvContent = req.file.buffer.toString();
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });

    const questions = records.map(row => {
      const options = [];
      // Expected columns: question,option_a,option_b,option_c,option_d,correct,marks,difficulty,section,explanation
      ['A', 'B', 'C', 'D'].forEach(letter => {
        const text = row[`option_${letter.toLowerCase()}`] || row[`Option ${letter}`] || '';
        if (text) {
          options.push({
            text,
            isCorrect: (row.correct || '').toUpperCase().split(',').map(s => s.trim()).includes(letter),
          });
        }
      });
      return {
        text: row.question || row.Question || '',
        options,
        marks: parseInt(row.marks || row.Marks || '1'),
        difficulty: (row.difficulty || row.Difficulty || 'medium').toLowerCase(),
        section: row.section || row.Section || 'General',
        explanation: row.explanation || row.Explanation || '',
        type: 'single',
      };
    }).filter(q => q.text && q.options.length >= 2);

    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    exam.questions.push(...questions);
    await exam.save();

    res.json({ 
      success: true, 
      message: `${questions.length} questions imported successfully.`,
      data: { imported: questions.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all students
// @route GET /api/admin/students
const getStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { role: 'student' };
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const total = await User.countDocuments(query);
    const students = await User.find(query)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Add attempt stats
    const studentIds = students.map(s => s._id);
    const stats = await Attempt.aggregate([
      { $match: { student: { $in: studentIds }, status: { $in: ['submitted', 'auto-submitted'] } } },
      { $group: { _id: '$student', count: { $sum: 1 }, avgScore: { $avg: '$percentage' } } }
    ]);
    const statsMap = {};
    stats.forEach(s => { statsMap[s._id.toString()] = s; });

    const enriched = students.map(student => ({
      ...student.toObject(),
      attemptCount: statsMap[student._id.toString()]?.count || 0,
      avgScore: Math.round(statsMap[student._id.toString()]?.avgScore || 0),
    }));

    res.json({ success: true, data: { students: enriched, pagination: { page, limit, total } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Ban student
// @route PUT /api/admin/students/:id/ban
const banStudent = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: true, banReason: reason || 'Violation of exam rules', currentDevice: null },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, message: 'Student banned.', data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Unban student
// @route PUT /api/admin/students/:id/unban
const unbanStudent = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned: false, banReason: '' },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'Student not found.' });
    res.json({ success: true, message: 'Student unbanned.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Reset student attempts for an exam
// @route DELETE /api/admin/students/:studentId/attempts/:examId
const resetAttempts = async (req, res) => {
  try {
    await Attempt.deleteMany({ student: req.params.studentId, exam: req.params.examId });
    res.json({ success: true, message: 'Attempts reset.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Export results as Excel
// @route GET /api/admin/exams/:id/export/excel
const exportExcel = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    const attempts = await Attempt.find({ exam: req.params.id, status: { $in: ['submitted', 'auto-submitted'] } })
      .populate('student', 'name email')
      .sort({ rank: 1 });

    const data = attempts.map(a => ({
      'Rank': a.rank,
      'Student Name': a.student?.name || 'N/A',
      'Email': a.student?.email || 'N/A',
      'Marks Obtained': a.marksObtained,
      'Total Marks': a.totalMarks,
      'Percentage': `${a.percentage}%`,
      'Status': a.isPassed ? 'PASSED' : 'FAILED',
      'Correct': a.correctCount,
      'Incorrect': a.incorrectCount,
      'Skipped': a.skippedCount,
      'Submitted At': a.submittedAt ? new Date(a.submittedAt).toLocaleString() : 'N/A',
      'Flagged': a.flagged ? 'YES' : 'NO',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/\s+/g, '_')}_results.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Export results as PDF
// @route GET /api/admin/exams/:id/export/pdf
const exportPDF = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    const attempts = await Attempt.find({ exam: req.params.id, status: { $in: ['submitted', 'auto-submitted'] } })
      .populate('student', 'name email')
      .sort({ rank: 1 });

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Disposition', `attachment; filename="${exam.title.replace(/\s+/g, '_')}_results.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(20).fillColor('#7C3AED').text(`Exam Results: ${exam.title}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#374151').text(`Total Questions: ${exam.questions.length} | Total Marks: ${exam.totalMarks}`, { align: 'center' });
    doc.moveDown(2);

    // Table headers
    const colWidths = [40, 150, 60, 60, 70, 80];
    const headers = ['Rank', 'Name', 'Marks', '%', 'Status', 'Submitted'];
    let x = 50;
    doc.fontSize(10).fillColor('#7C3AED');
    headers.forEach((h, i) => { doc.text(h, x, doc.y, { width: colWidths[i] }); x += colWidths[i]; });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.5);

    attempts.forEach((a, idx) => {
      if (doc.y > 700) { doc.addPage(); }
      x = 50;
      const row = [
        a.rank,
        a.student?.name || 'N/A',
        `${a.marksObtained}/${a.totalMarks}`,
        `${a.percentage}%`,
        a.isPassed ? 'PASSED' : 'FAILED',
        a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : 'N/A',
      ];
      const rowColor = idx % 2 === 0 ? '#F9FAFB' : '#FFFFFF';
      doc.rect(50, doc.y - 5, 500, 20).fill(rowColor);
      doc.fillColor(a.isPassed ? '#059669' : '#DC2626').fontSize(9);
      row.forEach((cell, i) => {
        doc.fillColor(i === 4 ? (a.isPassed ? '#059669' : '#DC2626') : '#374151')
          .text(String(cell), x, doc.y, { width: colWidths[i] });
        x += colWidths[i];
      });
      doc.moveDown(0.7);
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get exam analytics
// @route GET /api/admin/exams/:id/analytics
const getExamAnalytics = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    const attempts = await Attempt.find({ exam: req.params.id, status: { $in: ['submitted', 'auto-submitted'] } })
      .populate('student', 'name email');

    const totalAttempts = attempts.length;
    const passedCount = attempts.filter(a => a.isPassed).length;
    const avgScore = totalAttempts > 0 ? attempts.reduce((s, a) => s + a.percentage, 0) / totalAttempts : 0;
    const avgCorrect = totalAttempts > 0 ? attempts.reduce((s, a) => s + a.correctCount, 0) / totalAttempts : 0;

    // Score distribution
    const distribution = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
    attempts.forEach(a => {
      if (a.percentage <= 20) distribution[0]++;
      else if (a.percentage <= 40) distribution[1]++;
      else if (a.percentage <= 60) distribution[2]++;
      else if (a.percentage <= 80) distribution[3]++;
      else distribution[4]++;
    });

    res.json({
      success: true,
      data: {
        exam: { title: exam.title, totalMarks: exam.totalMarks },
        stats: {
          totalAttempts,
          passedCount,
          failedCount: totalAttempts - passedCount,
          passRate: totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0,
          avgScore: Math.round(avgScore),
          avgCorrect: Math.round(avgCorrect),
        },
        distribution: distribution.map((count, i) => ({
          range: `${i * 20 + 1}-${(i + 1) * 20}%`,
          count,
        })),
        attempts: attempts.map(a => ({
          studentName: a.student?.name,
          marksObtained: a.marksObtained,
          percentage: a.percentage,
          isPassed: a.isPassed,
          rank: a.rank,
          flagged: a.flagged,
        })),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboard, createExam, getAdminExams, getAdminExam, updateExam, deleteExam,
  importQuestions, getStudents, banStudent, unbanStudent, resetAttempts,
  exportExcel, exportPDF, getExamAnalytics,
};
