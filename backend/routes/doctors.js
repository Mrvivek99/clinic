const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');

// @route  GET /api/doctors
// @desc   Get all active doctors
// @access Public
router.get('/', async (req, res) => {
  try {
    const doctors = await Doctor.find({ isAvailable: true })
      .populate('userId', 'name email')
      .select('-__v');
    res.json({ doctors });
  } catch (err) {
    console.error('💥 CRASH in GET /doctors:', err);
    res.status(500).json({ error: '💥 CRASH IN ALL DOCTORS 💥', details: err.message });
  }
});

// @route  GET /api/doctors/:id
// @desc   Get doctor by ID
// @access Public
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate('userId', 'name email');
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    res.json({ doctor });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  POST /api/doctors
// @desc   Create a doctor profile (admin only)
// @access Private (admin)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const {
    userId,
    specialization,
    qualification,
    experience,
    consultationFee,
    slotDuration,
    workingDays,
    workingHours,
    breakTime,
    maxPatientsPerDay,
    bio,
  } = req.body;

  try {
    // Check if user exists and set role to doctor
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.role = 'doctor';
    await user.save({ validateBeforeSave: false });

    const doctor = new Doctor({
      userId,
      specialization,
      qualification,
      experience,
      consultationFee,
      slotDuration,
      workingDays,
      workingHours,
      breakTime,
      maxPatientsPerDay,
      bio,
    });

    await doctor.save();
    await doctor.populate('userId', 'name email');

    res.status(201).json({ message: 'Doctor profile created.', doctor });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  PUT /api/doctors/:id
// @desc   Update doctor profile
// @access Private (admin/doctor)
router.put('/:id', auth, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('userId', 'name email');

    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
    res.json({ message: 'Doctor updated.', doctor });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  GET /api/doctors/me
// @desc   Get current logged in doctor profile
// @access Private (doctor)
router.get('/me', auth, requireRole('doctor'), async (req, res) => {
  console.log('🔍 /doctors/me hit by user:', req.user._id);
  try {
    // Robust lookup: ensure req.user exists and has an ID
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'User context missing.' });
    }

    const doctor = await Doctor.findOne({ userId: req.user._id }).populate('userId', 'name email phone');
    console.log('🩺 Doctor lookup result for', req.user.name, ':', doctor ? 'Found ✅' : 'Not Found ❌');
    
    if (!doctor) {
      return res.status(404).json({ 
        error: 'Doctor profile not found.',
        message: 'Your user profile is set to "doctor" but your professional details are missing. Please go to Settings to complete your profile.'
      });
    }

    res.json({ doctor });
  } catch (err) {
    console.error('💥 CRASH in /doctors/me:', err);
    res.status(500).json({ 
      error: '💥 CRASH IN DOCTOR ME 💥', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// @route  POST /api/doctors/me
// @desc   Create or update current doctor profile
// @access Private (doctor)
router.post('/me', auth, requireRole('doctor'), async (req, res) => {
  const {
    specialization,
    qualification,
    experience,
    consultationFee,
    slotDuration,
    workingDays,
    workingHours,
    breakTime,
    maxPatientsPerDay,
    bio,
  } = req.body;

  try {
    let doctor = await Doctor.findOne({ userId: req.user._id });

    if (doctor) {
      // Update existing
      doctor = await Doctor.findByIdAndUpdate(
        doctor._id,
        { $set: req.body },
        { new: true, runValidators: true }
      );
    } else {
      // Create new
      doctor = new Doctor({
        userId: req.user._id,
        specialization,
        qualification,
        experience,
        consultationFee,
        slotDuration,
        workingDays,
        workingHours,
        breakTime,
        maxPatientsPerDay,
        bio,
      });
      await doctor.save();
    }

    await doctor.populate('userId', 'name email phone');
    res.json({ message: 'Doctor profile saved.', doctor });
  } catch (err) {
    res.status(500).json({ error: 'Server error.', detail: err.message });
  }
});

module.exports = router;

