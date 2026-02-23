const express = require('express');
const router = express.Router();
const { getDashboard, getProfile, updateProfile } = require('../controllers/studentController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;
