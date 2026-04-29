const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendLoginNotification, sendWelcomeNotification } = require('../utils/notifications');

/**
 * generateToken(userId)
 * ─────────────────────
 * Creates a signed JSON Web Token (JWT) that:
 *  - Contains { userId } as the payload (the "claim")
 *  - Is signed with JWT_SECRET (so nobody can forge or modify it)
 *  - Expires after JWT_EXPIRES_IN (default 7 days)
 *
 * The token is an opaque string of three Base64-encoded parts:
 *   header.payload.signature
 * e.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOi...
 *
 * The frontend stores this token in localStorage and sends it on every
 * authenticated request as:  Authorization: Bearer <token>
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @route  POST /api/auth/register
// @desc   Register a new patient (or doctor)
// @access Public
//
// Full registration flow:
//  1. Validate input fields (express-validator).
//  2. Check MongoDB – if the email already exists, return 400.
//  3. Create a new User document; the pre-save hook in User.js
//     automatically bcrypt-hashes the password before it reaches the DB.
//  4. If role === 'doctor', auto-create a Doctor profile document linked
//     to the new User via userId (ObjectId reference).
//  5. Call generateToken(user._id) → returns a signed JWT string.
//  6. Return the token + user object to the frontend.
//     The frontend stores the token in localStorage (Auth.setToken).
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

      // AUTO-CREATE DOCTOR PROFILE if role is doctor
      if (user.role === 'doctor') {
        const Doctor = require('../models/Doctor');
        const newDoctor = new Doctor({
          userId: user._id,
          specialization: 'General Physician',
          consultationFee: 500,
          isAvailable: true,
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          workingHours: { start: '09:00', end: '17:00' }
        });
        await newDoctor.save();
      }

      if (!process.env.JWT_SECRET) {
        console.error('❌ CRITICAL ERROR: JWT_SECRET is not defined in environment variables!');
        return res.status(500).json({ error: 'Server configuration error (JWT).' });
      }

      const token = generateToken(user._id);

      // Send welcome notification (Push + SMS)
      sendWelcomeNotification(user).catch(err => console.error('Welcome notification error:', err.message));

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
// @desc   Authenticate user and return a JWT token
// @access Public
//
// Full login flow:
//  1. Validate email + password fields.
//  2. Look up the User in MongoDB by email.
//     Note: password is excluded by default (select: false in schema)
//     so we explicitly add .select('+password') to fetch it here.
//  3. Call user.comparePassword() which uses bcrypt.compare() to check
//     the plain-text password against the stored hash.
//  4. Check isActive flag (admin can deactivate accounts).
//  5. Update lastLogin timestamp in MongoDB.
//  6. Call generateToken(user._id) → signed JWT string.
//  7. Respond with { token, user }.
//     Frontend: Auth.setToken(data.token) saves it to localStorage.
//              Auth.setUser(data.user) saves the user profile.
//     All subsequent API calls send:  Authorization: Bearer <token>
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

      // Send login alert (Push + SMS)
      sendLoginNotification(user).catch(err => console.error('Login notification error:', err.message));

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
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { fcmTokens: fcmToken } });
    res.json({ message: 'FCM token registered.' });
  } catch (err) {
    res.status(500).json({ error: '💥 CRASH IN UPDATE FCM 💥', details: err.message });
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
    res.status(500).json({ error: '💥 CRASH IN AUTH ME 💥', details: err.message });
  }
});

module.exports = router;
