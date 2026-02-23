const express = require('express');
const router = express.Router();
const { getExams, getExam } = require('../controllers/examController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getExams);
router.get('/:id', protect, getExam);

module.exports = router;
