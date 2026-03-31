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
    res.status(500).json({ error: 'Server error.' });
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

module.exports = router;
