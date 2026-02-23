const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');

// @desc Register user
// @route POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email, password, role: 'student' });

    const deviceId = uuidv4();
    const accessToken = generateAccessToken({ id: user._id, role: user.role, deviceId });
    const refreshToken = generateRefreshToken({ id: user._id, role: user.role, deviceId });

    // Store refresh token & device
    user.refreshToken = refreshToken;
    user.currentDevice = deviceId;
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    await user.save({ validateBeforeSave: false });

    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        accessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Login user
// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshToken +currentDevice');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ 
        success: false, 
        message: `Account banned: ${user.banReason || 'Contact administrator.'}` 
      });
    }

    const deviceId = uuidv4();
    const accessToken = generateAccessToken({ id: user._id, role: user.role, deviceId });
    const refreshToken = generateRefreshToken({ id: user._id, role: user.role, deviceId });

    user.refreshToken = refreshToken;
    user.currentDevice = deviceId;
    user.lastLogin = new Date();
    user.lastLoginIP = req.ip;
    await user.save({ validateBeforeSave: false });

    setRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Refresh access token
// @route POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No refresh token.' });
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken +currentDevice');

    if (!user || user.refreshToken !== token) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    const deviceId = uuidv4();
    const newAccessToken = generateAccessToken({ id: user._id, role: user.role, deviceId });
    const newRefreshToken = generateRefreshToken({ id: user._id, role: user.role, deviceId });

    user.refreshToken = newRefreshToken;
    user.currentDevice = deviceId;
    await user.save({ validateBeforeSave: false });

    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
  }
};

// @desc Logout
// @route POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const user = await User.findOne({}).select('+refreshToken');
      if (user) {
        user.refreshToken = null;
        user.currentDevice = null;
        await user.save({ validateBeforeSave: false });
      }
    }
    clearRefreshTokenCookie(res);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    clearRefreshTokenCookie(res);
    res.json({ success: true, message: 'Logged out.' });
  }
};

// @desc Get current user
// @route GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, refreshToken, logout, getMe };
