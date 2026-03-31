const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @route  POST /api/auth/register
// @desc   Register a new patient
// @access Public
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').matches(/^\+?[\d\s-]{10,15}$/).withMessage('Valid phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('⚠️ Registration Validation Errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, password, dateOfBirth, gender, bloodGroup, role } = req.body;

    try {
      // Check if user already exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        console.log(`❌ Registration failed: User already exists (${email})`);
        return res.status(400).json({ error: 'User already exists.' });
      }

      const user = new User({ name, email, phone, password, dateOfBirth, gender, bloodGroup, role: role || 'patient' });
      await user.save();
      console.log(`✅ User registered: ${email}`);

      if (!process.env.JWT_SECRET) {
        console.error('❌ CRITICAL ERROR: JWT_SECRET is not defined in environment variables!');
        return res.status(500).json({ error: 'Server configuration error (JWT).' });
      }

      const token = generateToken(user._id);

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: user.toJSON(),
      });
    } catch (err) {
      console.error('❌ Registration Error:', err);
      res.status(500).json({ error: 'Server error during registration.', detail: err.message });
    }
  }
);

// @route  POST /api/auth/login
// @desc   Login user
// @access Public
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      console.log(`🔑 Login attempt for: ${email}`);
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        console.log(`❌ Login failed: User not found (${email})`);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        console.log(`❌ Login failed: Incorrect password for (${email})`);
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      if (!user.isActive) {
        return res.status(401).json({ error: 'Account is deactivated.' });
      }

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      const token = generateToken(user._id);

      res.json({
        message: 'Login successful',
        token,
        user: user.toJSON(),
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error during login.' });
    }
  }
);

// @route  GET /api/auth/me
// @desc   Get current user
// @access Private
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// @route  PUT /api/auth/update-fcm-token
// @desc   Update Firebase Cloud Messaging token
// @access Private
router.put('/update-fcm-token', auth, async (req, res) => {
  const { fcmToken } = req.body;
  if (!fcmToken) {
    return res.status(400).json({ error: 'FCM token is required.' });
  }
  try {
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ message: 'FCM token updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  PUT /api/auth/profile
// @desc   Update user profile
// @access Private
router.put('/profile', auth, async (req, res) => {
  const { name, phone, dateOfBirth, gender, bloodGroup } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, dateOfBirth, gender, bloodGroup },
      { new: true, runValidators: true }
    );
    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
