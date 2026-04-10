const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token, authorization denied.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (!user.isActive) return res.status(401).json({ error: 'Account is deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    console.log(`🛡️  Role Check: Need [${roles.join(', ')}] - User has [${req.user?.role || 'NONE'}]`);
    
    if (!req.user || !req.user.role) {
      console.error('💥 AUTH CRASH: req.user or role is missing!');
      return res.status(401).json({ error: 'Authentication data missing.' });
    }

    if (!roles.includes(req.user.role)) {
      console.warn(`⛔ Access Denied: User ${req.user.email} is ${req.user.role}, not ${roles.join(' or ')}`);
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    next();
  };
};

module.exports = { auth, requireRole };
