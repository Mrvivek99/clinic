const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { auth } = require('../middleware/auth');

// @route  GET /api/queue/status
// @desc   Get live queue status for a doctor on a date
// @access Private
router.get('/status', auth, async (req, res) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return res.status(400).json({ error: 'doctorId and date are required.' });
  }

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });

    const appointments = await Appointment.find({
      doctorId,
      date,
      status: { $in: ['booked', 'in-progress', 'completed', 'missed'] },
    })
      .populate('userId', 'name')
      .sort({ tokenNumber: 1 });

    const currentlyServing = appointments.find((a) => a.status === 'in-progress');
    const waiting = appointments.filter((a) => a.status === 'booked');
    const completed = appointments.filter((a) => a.status === 'completed');
    const missed = appointments.filter((a) => a.status === 'missed');

    // Get user's appointment if patient
    let userAppointment = null;
    if (req.user.role === 'patient') {
      userAppointment = appointments.find(
        (a) => a.userId._id.toString() === req.user._id.toString()
      );
    }

    // Calculate wait times
    const slotDuration = doctor.slotDuration || 15;
    const enrichedWaiting = waiting.map((appt, idx) => ({
      tokenNumber: appt.tokenNumber,
      patientName: req.user.role !== 'patient' ? appt.userId.name : `Patient ${appt.tokenNumber}`,
      estimatedWaitMinutes: (idx + (currentlyServing ? 1 : 0)) * slotDuration,
      isCurrentUser: appt.userId._id.toString() === req.user._id.toString(),
    }));

    res.json({
      queueStatus: {
        doctorId,
        date,
        currentTokenServing: doctor.currentTokenServing,
        currentlyServing: currentlyServing
          ? {
              tokenNumber: currentlyServing.tokenNumber,
              slotTime: currentlyServing.slotTime,
            }
          : null,
        totalWaiting: waiting.length,
        totalCompleted: completed.length,
        totalMissed: missed.length,
        slotDuration,
        waitingList: enrichedWaiting,
        userAppointment: userAppointment
          ? {
              tokenNumber: userAppointment.tokenNumber,
              status: userAppointment.status,
              slotTime: userAppointment.slotTime,
              position: enrichedWaiting.findIndex((a) => a.isCurrentUser) + 1,
              estimatedWaitMinutes:
                enrichedWaiting.find((a) => a.isCurrentUser)?.estimatedWaitMinutes || 0,
              qrCode: userAppointment.qrCode,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('Queue status error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// @route  GET /api/queue/my-position
// @desc   Get patient's current queue position
// @access Private
router.get('/my-position', auth, async (req, res) => {
  const { appointmentId } = req.query;

  try {
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      userId: req.user._id,
    });

    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });

    const aheadCount = await Appointment.countDocuments({
      doctorId: appointment.doctorId,
      date: appointment.date,
      status: 'booked',
      tokenNumber: { $lt: appointment.tokenNumber },
    });

    const doctor = await Doctor.findById(appointment.doctorId);
    const slotDuration = doctor?.slotDuration || 15;
    const currentlyServing = await Appointment.findOne({
      doctorId: appointment.doctorId,
      date: appointment.date,
      status: 'in-progress',
    });

    const estimatedWaitMinutes = (aheadCount + (currentlyServing ? 1 : 0)) * slotDuration;

    res.json({
      tokenNumber: appointment.tokenNumber,
      status: appointment.status,
      position: aheadCount + 1,
      estimatedWaitMinutes,
      currentTokenServing: doctor?.currentTokenServing || 0,
      slotTime: appointment.slotTime,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
