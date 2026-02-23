require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Exam = require('../models/Exam');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected for seeding...');
};

const seed = async () => {
  await connectDB();
  
  try {
    // Clear existing data
    await User.deleteMany({});
    await Exam.deleteMany({});
    console.log('Cleared existing data');

    // Create admin
    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@examportal.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@123456',
      role: 'admin',
    });
    console.log('✅ Admin created:', admin.email);

    // Create sample students
    const students = await User.insertMany([
      { name: 'Alice Johnson', email: 'alice@student.com', password: 'Student@123', role: 'student' },
      { name: 'Bob Smith', email: 'bob@student.com', password: 'Student@123', role: 'student' },
      { name: 'Carol Davis', email: 'carol@student.com', password: 'Student@123', role: 'student' },
    ]);
    console.log('✅ Sample students created');

    // Create sample exam
    const now = new Date();
    const exam = await Exam.create({
      title: 'JavaScript Fundamentals',
      description: 'Test your knowledge of JavaScript basics',
      instructions: 'Read each question carefully. Each question carries equal marks. No negative marking.',
      createdBy: admin._id,
      duration: 30,
      startTime: new Date(now.getTime() - 60 * 60 * 1000), // started 1hr ago
      endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // ends in 24hrs
      passingMarks: 6,
      maxAttempts: 2,
      shuffleQuestions: true,
      shuffleOptions: true,
      negativeMarking: false,
      showResultImmediately: true,
      isPublished: true,
      category: 'Programming',
      questions: [
        {
          text: 'What is the output of: typeof null?',
          type: 'single',
          options: [
            { text: '"null"', isCorrect: false },
            { text: '"object"', isCorrect: true },
            { text: '"undefined"', isCorrect: false },
            { text: '"string"', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'easy',
          section: 'Basics',
          explanation: 'typeof null returns "object" — this is a well-known JavaScript bug.',
        },
        {
          text: 'Which method is used to add an element at the end of an array?',
          type: 'single',
          options: [
            { text: 'push()', isCorrect: true },
            { text: 'pop()', isCorrect: false },
            { text: 'shift()', isCorrect: false },
            { text: 'unshift()', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'easy',
          section: 'Arrays',
        },
        {
          text: 'What does "use strict" do in JavaScript?',
          type: 'single',
          options: [
            { text: 'Enables strict type checking', isCorrect: false },
            { text: 'Enforces stricter parsing and error handling', isCorrect: true },
            { text: 'Makes code run faster', isCorrect: false },
            { text: 'Disables console.log', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'medium',
          section: 'Basics',
        },
        {
          text: 'Which of the following are falsy values in JavaScript?',
          type: 'multiple',
          options: [
            { text: '0', isCorrect: true },
            { text: '"false"', isCorrect: false },
            { text: 'null', isCorrect: true },
            { text: 'undefined', isCorrect: true },
          ],
          marks: 2,
          difficulty: 'medium',
          section: 'Basics',
        },
        {
          text: 'Promises in JavaScript are used to handle asynchronous operations.',
          type: 'truefalse',
          options: [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'easy',
          section: 'Async',
        },
        {
          text: 'What is closure in JavaScript?',
          type: 'single',
          options: [
            { text: 'A way to close a browser window', isCorrect: false },
            { text: 'A function that has access to its outer scope even after the outer function has returned', isCorrect: true },
            { text: 'A method to end a loop', isCorrect: false },
            { text: 'An error handling mechanism', isCorrect: false },
          ],
          marks: 2,
          difficulty: 'hard',
          section: 'Advanced',
          explanation: 'Closures allow a function to access variables from its outer (enclosing) function scope even after that function has executed.',
        },
        {
          text: 'Which ES6 feature allows destructuring of objects?',
          type: 'single',
          options: [
            { text: 'const { name } = obj;', isCorrect: true },
            { text: 'const name = obj.extract();', isCorrect: false },
            { text: 'let [name] = obj;', isCorrect: false },
            { text: 'var name == obj.name;', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'medium',
          section: 'ES6',
        },
        {
          text: 'What is the purpose of the "async/await" syntax?',
          type: 'single',
          options: [
            { text: 'To create synchronous code only', isCorrect: false },
            { text: 'To make asynchronous code look and behave more like synchronous code', isCorrect: true },
            { text: 'To improve performance', isCorrect: false },
            { text: 'To handle errors only', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'medium',
          section: 'Async',
        },
        {
          text: 'What does the spread operator (...) do?',
          type: 'single',
          options: [
            { text: 'Multiplies array elements', isCorrect: false },
            { text: 'Expands an iterable into individual elements', isCorrect: true },
            { text: 'Creates a new object', isCorrect: false },
            { text: 'Removes duplicates from an array', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'medium',
          section: 'ES6',
        },
        {
          text: 'Which method is used to convert JSON string to JavaScript object?',
          type: 'single',
          options: [
            { text: 'JSON.stringify()', isCorrect: false },
            { text: 'JSON.parse()', isCorrect: true },
            { text: 'JSON.convert()', isCorrect: false },
            { text: 'JSON.objectify()', isCorrect: false },
          ],
          marks: 1,
          difficulty: 'easy',
          section: 'Basics',
        },
      ],
    });
    console.log('✅ Sample exam created:', exam.title);
    console.log('\n🎉 Seeding complete!');
    console.log('\nAdmin credentials:');
    console.log('  Email:', admin.email);
    console.log('  Password:', process.env.ADMIN_PASSWORD || 'Admin@123456');
    console.log('\nStudent credentials (all use password: Student@123)');
    console.log('  alice@student.com');
    console.log('  bob@student.com');
    console.log('  carol@student.com');
    
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    mongoose.connection.close();
  }
};

seed();
