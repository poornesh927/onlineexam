const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized. No token.' });
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select('+currentDevice');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    if (!user.isActive || user.isBanned) {
      return res.status(403).json({ success: false, message: 'Account is banned or deactivated.' });
    }

    // Single device check
    if (decoded.deviceId && user.currentDevice && user.currentDevice !== decoded.deviceId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expired. Logged in from another device.',
        code: 'DEVICE_CONFLICT'
      });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Role '${req.user.role}' is not authorized for this action.` 
      });
    }
    next();
  };
};

const adminOnly = authorize('admin');
const studentOnly = authorize('student');

module.exports = { protect, authorize, adminOnly, studentOnly };
