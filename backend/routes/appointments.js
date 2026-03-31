const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const Doctor = require('../models/Doctor');
const { auth } = require('../middleware/auth');
const { generateQRCode } = require('../utils/qrCode');

// @route  POST /api/appointments/book-slot
// @desc   Book an appointment slot
// @access Private (patients)
router.post(
  '/book-slot',
  auth,
  [
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
    body('slotId').notEmpty().withMessage('Slot ID is required'),
    body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date format: YYYY-MM-DD'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { doctorId, slotId, date, symptoms } = req.body;
    const io = req.app.get('io');

    try {
      // Prevent double-booking: check if user already has appointment on this date
      const existingAppt = await Appointment.findOne({
        userId: req.user._id,
        doctorId,
        date,
        status: { $in: ['booked', 'in-progress'] },
      });
      if (existingAppt) {
        return res.status(400).json({ error: 'You already have an active appointment with this doctor on this date.' });
      }

      // Check slot availability with atomic update
      const slot = await Slot.findOneAndUpdate(
        { _id: slotId, doctorId, date, isBooked: false, isBlocked: false },
        { isBooked: true },
        { new: true }
      );

      if (!slot) {
        return res.status(400).json({ error: 'Slot is no longer available.' });
      }

      // Get next token number for this doctor on this date
      const lastAppt = await Appointment.findOne({ doctorId, date })
        .sort({ tokenNumber: -1 })
        .select('tokenNumber');
      const tokenNumber = (lastAppt?.tokenNumber || 0) + 1;

      // Calculate estimated wait time
      const doctor = await Doctor.findById(doctorId);
      const pendingCount = await Appointment.countDocuments({
        doctorId,
        date,
        status: { $in: ['booked', 'in-progress'] },
      });
      const estimatedWaitMinutes = pendingCount * (doctor?.slotDuration || 15);

      // Create appointment
      const appointment = new Appointment({
        userId: req.user._id,
        doctorId,
        slotId,
        date,
        slotTime: slot.startTime,
        tokenNumber,
        symptoms,
        estimatedWaitMinutes,
      });

      // Generate QR code
      const qrData = JSON.stringify({
        appointmentId: appointment._id,
        token: tokenNumber,
        date,
        patientName: req.user.name,
      });
      appointment.qrCode = await generateQRCode(qrData);

      // Update slot with appointment reference
      slot.appointmentId = appointment._id;
      await slot.save();
      await appointment.save();

      // Emit real-time update to queue room
      io.to(`queue-${date}`).emit('queue-updated', {
        doctorId,
        date,
        type: 'new-booking',
        tokenNumber,
      });

      await appointment.populate([
        { path: 'userId', select: 'name email phone' },
        { path: 'doctorId', populate: { path: 'userId', select: 'name' } },
      ]);

      res.status(201).json({
        message: 'Appointment booked successfully!',
        appointment,
      });
    } catch (err) {
      console.error('Booking error:', err);
      res.status(500).json({ error: 'Server error while booking appointment.' });
    }
  }
);

// @route  GET /api/appointments/my-appointments
// @desc   Get patient's appointments
// @access Private
router.get('/my-appointments', auth, async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .sort({ date: -1, slotTime: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(filter);

    res.json({ appointments, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  GET /api/appointments/:id
// @desc   Get single appointment details
// @access Private
router.get('/:id', auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate({ path: 'userId', select: 'name email phone' })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    // Patients can only view their own appointments
    if (
      req.user.role === 'patient' &&
      appointment.userId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({ appointment });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  PUT /api/appointments/:id/cancel
// @desc   Cancel an appointment
// @access Private
router.put('/:id/cancel', auth, async (req, res) => {
  const io = req.app.get('io');
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });

    if (appointment.userId.toString() !== req.user._id.toString() && req.user.role === 'patient') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({ error: `Cannot cancel a ${appointment.status} appointment.` });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    // Free the slot
    await Slot.findByIdAndUpdate(appointment.slotId, { isBooked: false, appointmentId: null });

    io.to(`queue-${appointment.date}`).emit('queue-updated', {
      doctorId: appointment.doctorId,
      date: appointment.date,
      type: 'cancelled',
      tokenNumber: appointment.tokenNumber,
    });

    res.json({ message: 'Appointment cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  PUT /api/appointments/update-status
// @desc   Update appointment status (doctor/admin)
// @access Private (doctor/admin)
router.put('/:id/update-status', auth, async (req, res) => {
  const { status, notes } = req.body;
  const io = req.app.get('io');

  if (!['in-progress', 'completed', 'missed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });

    const prevStatus = appointment.status;
    appointment.status = status;
    if (notes) appointment.notes = notes;
    if (status === 'completed') appointment.completedAt = new Date();
    if (status === 'in-progress') appointment.checkedInAt = new Date();
    await appointment.save();

    // Update doctor's current serving token
    if (status === 'in-progress') {
      await Doctor.findByIdAndUpdate(appointment.doctorId, {
        currentTokenServing: appointment.tokenNumber,
      });
    }

    io.to(`queue-${appointment.date}`).emit('queue-updated', {
      doctorId: appointment.doctorId,
      date: appointment.date,
      type: 'status-change',
      tokenNumber: appointment.tokenNumber,
      status,
      prevStatus,
    });

    res.json({ message: `Appointment marked as ${status}.`, appointment });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
