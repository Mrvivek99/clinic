const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Slot = require('../models/Slot');
const { auth, requireRole } = require('../middleware/auth');
const { generateDailySlots } = require('../utils/slotGenerator');

// All admin routes require authentication and admin/doctor role
router.use(auth, requireRole('admin', 'doctor'));

// @route  GET /api/admin/dashboard
// @desc   Get today's dashboard stats
// @access Private (admin)
router.get('/dashboard', requireRole('admin'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const [totalToday, completed, missed, booked, inProgress, totalPatients, totalDoctors] =
      await Promise.all([
        Appointment.countDocuments({ date: today }),
        Appointment.countDocuments({ date: today, status: 'completed' }),
        Appointment.countDocuments({ date: today, status: 'missed' }),
        Appointment.countDocuments({ date: today, status: 'booked' }),
        Appointment.countDocuments({ date: today, status: 'in-progress' }),
        User.countDocuments({ role: 'patient' }),
        Doctor.countDocuments(),
      ]);

    // Average wait time (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCompleted = await Appointment.find({
      status: 'completed',
      completedAt: { $gte: weekAgo },
      checkedInAt: { $ne: null },
    }).select('checkedInAt completedAt');

    let avgWaitMinutes = 0;
    if (recentCompleted.length > 0) {
      const totalMs = recentCompleted.reduce((sum, a) => {
        return sum + (a.completedAt - a.checkedInAt);
      }, 0);
      avgWaitMinutes = Math.round(totalMs / recentCompleted.length / 60000);
    }

    // Appointments by doctor today
    const byDoctor = await Appointment.aggregate([
      { $match: { date: today } },
      {
        $group: {
          _id: '$doctorId',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending: {
            $sum: { $cond: [{ $in: ['$status', ['booked', 'in-progress']] }, 1, 0] },
          },
        },
      },
    ]);

    res.json({
      today,
      stats: {
        totalToday,
        completed,
        missed,
        booked,
        inProgress,
        totalPatients,
        totalDoctors,
        avgWaitMinutes,
      },
      byDoctor,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  GET /api/admin/appointments
// @desc   Get appointments with filters (admin/doctor)
// @access Private
router.get('/appointments', async (req, res) => {
  const { date, doctorId, status, page = 1, limit = 20 } = req.query;

  try {
    const filter = {};
    if (date) filter.date = date;
    if (status) filter.status = status;

    // Doctors can only see their own appointments
    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user._id });
      if (doctor) {
        filter.doctorId = doctor._id;
      } else {
        // If doctor profile not found, return empty results immediately
        return res.json({ appointments: [], total: 0, page: parseInt(page) });
      }
    } else if (doctorId) {
      filter.doctorId = doctorId;
    }

    const appointments = await Appointment.find(filter)
      .populate('userId', 'name email phone')
      .populate({ path: 'doctorId', populate: { path: 'userId', select: 'name' } })
      .sort({ tokenNumber: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(filter);

    res.json({ appointments, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  POST /api/admin/emergency-patient
// @desc   Add emergency/walk-in patient
// @access Private (doctor/admin)
router.post('/emergency-patient', async (req, res) => {
  const { patientId, doctorId, date, symptoms } = req.body;
  const io = req.app.get('io');

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });

    // Create emergency slot
    const emergencySlot = new Slot({
      doctorId,
      date,
      startTime: 'EMERGENCY',
      endTime: 'EMERGENCY',
      isBooked: true,
    });
    await emergencySlot.save();

    // Get highest token number and add emergency at front
    const highestToken = await Appointment.findOne({ doctorId, date })
      .sort({ tokenNumber: -1 })
      .select('tokenNumber');

    // Emergency patients get a special token (e.g., E1, E2 — stored as negative numbers)
    const emergencyTokens = await Appointment.find({
      doctorId,
      date,
      isEmergency: true,
    }).select('tokenNumber');
    const emergencyNum = -(emergencyTokens.length + 1);

    const appointment = new Appointment({
      userId: patientId,
      doctorId,
      slotId: emergencySlot._id,
      date,
      slotTime: 'EMERGENCY',
      tokenNumber: doctor.currentTokenServing + 1, // Inserted right after current
      isEmergency: true,
      symptoms,
      status: 'booked',
    });
    await appointment.save();

    // Shift all pending tokens up by 1
    await Appointment.updateMany(
      {
        doctorId,
        date,
        status: 'booked',
        tokenNumber: { $gt: doctor.currentTokenServing },
        _id: { $ne: appointment._id },
      },
      { $inc: { tokenNumber: 1 } }
    );

    emergencySlot.appointmentId = appointment._id;
    await emergencySlot.save();

    io.to(`queue-${date}`).emit('queue-updated', {
      doctorId,
      date,
      type: 'emergency',
      tokenNumber: appointment.tokenNumber,
    });

    res.status(201).json({
      message: 'Emergency patient added to queue.',
      appointment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  POST /api/admin/generate-slots
// @desc   Generate time slots for a doctor for a date
// @access Private (admin)
router.post('/generate-slots', requireRole('admin'), async (req, res) => {
  const { doctorId, date } = req.body;
  try {
    const result = await generateDailySlots(doctorId, date);
    res.json({ message: `Generated ${result.count} slots for ${date}.`, slots: result.slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error.' });
  }
});

// @route  GET /api/admin/analytics
// @desc   Get analytics data
// @access Private (admin)
router.get('/analytics', requireRole('admin'), async (req, res) => {
  const { days = 7 } = req.query;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  const startDateStr = startDate.toISOString().split('T')[0];

  try {
    const dailyStats = await Appointment.aggregate([
      { $match: { date: { $gte: startDateStr } } },
      {
        $group: {
          _id: '$date',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ dailyStats });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
