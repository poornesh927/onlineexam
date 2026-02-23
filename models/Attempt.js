const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  selectedOptions: [{ type: mongoose.Schema.Types.ObjectId }], // option IDs
  isCorrect: { type: Boolean, default: false },
  marksObtained: { type: Number, default: 0 },
  timeSpent: { type: Number, default: 0 }, // seconds
  answeredAt: { type: Date },
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Question order (after shuffling)
  questionOrder: [{ type: mongoose.Schema.Types.ObjectId }],
  optionOrder: { type: Map, of: [{ type: mongoose.Schema.Types.ObjectId }] },
  
  // Answers
  answers: [answerSchema],
  
  // Timing
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  serverEndTime: { type: Date }, // absolute deadline from server
  timeLeft: { type: Number }, // seconds remaining (synced)
  
  // Results
  status: { 
    type: String, 
    enum: ['in-progress', 'submitted', 'auto-submitted', 'expired'], 
    default: 'in-progress' 
  },
  totalMarks: { type: Number, default: 0 },
  marksObtained: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  isPassed: { type: Boolean, default: false },
  rank: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  
  // Anti-cheat
  tabSwitchCount: { type: Number, default: 0 },
  fullscreenExitCount: { type: Number, default: 0 },
  ipAddress: { type: String },
  deviceInfo: { type: String },
  flagged: { type: Boolean, default: false },
  flagReason: { type: String, default: '' },
  
  // Exam token (per attempt security)
  examToken: { type: String, select: false },
}, { timestamps: true });

// Index for performance
attemptSchema.index({ exam: 1, student: 1 });
attemptSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Attempt', attemptSchema);
