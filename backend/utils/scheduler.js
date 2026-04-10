const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendSMSReminder, sendPushNotification } = require('./notifications');

/**
 * Initialize all cron jobs for the clinic system
 * @param {import('socket.io').Server} io
 */
function initScheduler(io) {
  console.log('⏰ Initializing cron scheduler...');

  // Run every minute to check for upcoming appointments (10-min reminders)
  cron.schedule('* * * * *', async () => {
    await sendUpcomingReminders(io);
  });

  // Run daily at midnight to reset doctor token counters
  cron.schedule('0 0 * * *', async () => {
    await resetDailyCounters();
  });

  // Run every 5 minutes to mark missed appointments
  cron.schedule('*/5 * * * *', async () => {
    await markMissedAppointments();
  });

  console.log('✅ Cron scheduler initialized.');
}

/**
 * Send reminders for appointments in the next 10 minutes
 */
async function sendUpcomingReminders(io) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reminderWindow = currentMinutes + 10; // 10 minutes ahead

  const reminderTime = minutesToTime(reminderWindow);
  const currentTime = minutesToTime(currentMinutes);

  try {
    const upcoming = await Appointment.find({
      date: today,
      slotTime: { $gt: currentTime, $lte: reminderTime },
      status: 'booked',
      reminderSent: false,
    }).populate('userId', 'name phone fcmTokens email');

    for (const appt of upcoming) {
      const patient = appt.userId;

      // Send SMS reminder
      if (patient.phone) {
        await sendSMSReminder(patient.phone, {
          patientName: patient.name,
          slotTime: appt.slotTime,
          tokenNumber: appt.tokenNumber,
          date: appt.date,
        });
      }

      // Send Push reminder to all devices
      if (patient.fcmTokens && patient.fcmTokens.length > 0) {
        await sendPushNotification(patient.fcmTokens, {
          title: '⏰ Appointment Reminder',
          body: `Hi ${patient.name}, your appointment is in 10 minutes at ${appt.slotTime}.`,
        }).catch(err => console.error('Reminder push error:', err.message));
      }

      // Emit socket notification
      io.emit(`reminder-${patient._id}`, {
        message: `Reminder: Your appointment is in 10 minutes at ${appt.slotTime}`,
        tokenNumber: appt.tokenNumber,
        slotTime: appt.slotTime,
      });

      // Mark reminder as sent
      appt.reminderSent = true;
      appt.reminderSentAt = new Date();
      await appt.save();

      console.log(`📱 Reminder sent to ${patient.name} for slot ${appt.slotTime}`);
    }
  } catch (err) {
    console.error('Reminder scheduler error:', err);
  }
}

/**
 * Mark appointments as missed if slot time has passed with no check-in
 */
async function markMissedAppointments() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentTime = minutesToTime(now.getHours() * 60 + now.getMinutes());

  try {
    const result = await Appointment.updateMany(
      {
        date: today,
        slotTime: { $lt: currentTime },
        status: 'booked',
      },
      { status: 'missed' }
    );

    if (result.modifiedCount > 0) {
      console.log(`⚠️ Marked ${result.modifiedCount} appointments as missed.`);
    }
  } catch (err) {
    console.error('Mark missed error:', err);
  }
}

/**
 * Reset daily doctor stats at midnight
 */
async function resetDailyCounters() {
  try {
    const Doctor = require('../models/Doctor');
    await Doctor.updateMany({}, { currentTokenServing: 0 });
    console.log('🔄 Daily counters reset.');
  } catch (err) {
    console.error('Reset counters error:', err);
  }
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = { initScheduler };
