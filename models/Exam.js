const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
}, { _id: true });

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['single', 'multiple', 'truefalse'], default: 'single' },
  options: [optionSchema],
  explanation: { type: String, default: '' },
  marks: { type: Number, default: 1 },
  negativeMark: { type: Number, default: 0 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  section: { type: String, default: 'General' },
  timeLimit: { type: Number, default: 0 }, // 0 = no individual limit, seconds
}, { _id: true });

const examSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  instructions: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [questionSchema],
  
  // Timing
  duration: { type: Number, required: true }, // in minutes
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  
  // Settings
  totalMarks: { type: Number, default: 0 },
  passingMarks: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 1 },
  shuffleQuestions: { type: Boolean, default: true },
  shuffleOptions: { type: Boolean, default: true },
  negativeMarking: { type: Boolean, default: false },
  negativeMarkValue: { type: Number, default: 0 },
  showResultImmediately: { type: Boolean, default: true },
  
  // Status
  isPublished: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  
  // Categories/tags
  category: { type: String, default: 'General' },
  tags: [String],
  sections: [String],
}, { timestamps: true });

// Calculate total marks before save
examSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce((sum, q) => sum + q.marks, 0);
  }
  next();
});

module.exports = mongoose.model('Exam', examSchema);
