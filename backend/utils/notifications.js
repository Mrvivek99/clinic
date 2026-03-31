/**
 * Notification utilities for SMS (Twilio) and Push (Firebase)
 * Falls back gracefully if credentials are not configured or packages not installed
 */

let twilioClient = null;
let firebaseAdmin = null;

// Initialize Twilio
function initTwilio() {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      console.log('✅ Twilio initialized');
    } catch (err) {
      console.warn('⚠️  Twilio package not installed. SMS notifications disabled.');
    }
  } else {
    console.warn('⚠️  Twilio credentials not configured. SMS notifications disabled.');
  }
}

// Initialize Firebase Admin
function initFirebase() {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });
      }
      firebaseAdmin = admin;
      console.log('✅ Firebase Admin initialized');
    } catch (err) {
      console.warn('⚠️  Firebase Admin package not installed or config error. Push notifications disabled.');
      console.warn('   Error:', err.message);
    }
  } else {
    console.warn('⚠️  Firebase credentials not configured. Push notifications disabled.');
  }
}

// Initialize on module load
initTwilio();
initFirebase();

/**
 * Send SMS reminder via Twilio
 */
async function sendSMSReminder(phoneNumber, { patientName, slotTime, tokenNumber, date }) {
  if (!twilioClient) {
    console.log(`[SMS Mock] Reminder to ${phoneNumber}: Appointment at ${slotTime}, Token #${tokenNumber}`);
    return { success: true, mock: true };
  }

  const message = `Hi ${patientName}! 🏥 Reminder: Your appointment at ${process.env.CLINIC_NAME || 'the clinic'} is in 10 minutes.\n📅 Date: ${date}\n⏰ Time: ${slotTime}\n🎫 Token: #${tokenNumber}\n\nPlease arrive on time.`;

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    console.log(`SMS sent: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (err) {
    console.error('Twilio SMS error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send push notification via Firebase Cloud Messaging
 */
async function sendPushNotification(fcmToken, { title, body, data = {} }) {
  if (!firebaseAdmin || !fcmToken) {
    console.log(`[Push Mock] To: ${fcmToken}, Title: ${title}, Body: ${body}`);
    return { success: true, mock: true };
  }

  const message = {
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    token: fcmToken,
    android: { notification: { sound: 'default', priority: 'high' } },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };

  try {
    const result = await firebaseAdmin.messaging().send(message);
    return { success: true, messageId: result };
  } catch (err) {
    console.error('FCM error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send appointment confirmation notification
 */
async function sendBookingConfirmation(user, appointment) {
  const payload = {
    title: '✅ Appointment Confirmed!',
    body: `Your appointment is booked for ${appointment.date} at ${appointment.slotTime}. Token: #${appointment.tokenNumber}`,
    data: {
      appointmentId: appointment._id.toString(),
      tokenNumber: appointment.tokenNumber,
      type: 'booking_confirmation',
    },
  };

  if (user.fcmToken) {
    await sendPushNotification(user.fcmToken, payload);
  }

  if (user.phone) {
    await sendSMSReminder(user.phone, {
      patientName: user.name,
      slotTime: appointment.slotTime,
      tokenNumber: appointment.tokenNumber,
      date: appointment.date,
    });
  }
}

module.exports = {
  sendSMSReminder,
  sendPushNotification,
  sendBookingConfirmation,
};
