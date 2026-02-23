const express = require('express');
const router = express.Router();
const { startAttempt, saveAnswers, submitAttempt, getResult, getHistory, reportEvent } = require('../controllers/attemptController');
const { protect, studentOnly } = require('../middleware/auth');

router.use(protect);

router.get('/history', getHistory);
router.post('/start/:examId', startAttempt);
router.put('/:id/save', saveAnswers);
router.post('/:id/submit', submitAttempt);
router.get('/:id/result', getResult);
router.post('/:id/report', reportEvent);

module.exports = router;
