const mongoose = require('mongoose');
const User = require('./models/User');
const Doctor = require('./models/Doctor');

async function seedDatabase() {
  console.log('🌱 Starting database seed...');

  // ── Create Admin User ──
  let admin = await User.findOne({ email: 'admin@clinic.com' });
  if (!admin) {
    admin = new User({
      name: 'Admin User',
      email: 'admin@clinic.com',
      phone: '+91 9876543210',
      password: 'admin123',
      role: 'admin',
    });
    await admin.save();
    console.log('✅ Admin created: admin@clinic.com / admin123');
  }

  // ── Create Doctor User ──
  let doctorUser = await User.findOne({ email: 'doctor@clinic.com' });
  if (!doctorUser) {
    doctorUser = new User({
      name: 'Dr. Sharma',
      email: 'doctor@clinic.com',
      phone: '+91 9876543211',
      password: 'doctor123',
      role: 'doctor',
    });
    await doctorUser.save();

    const doctorProfile = new Doctor({
      userId: doctorUser._id,
      specialization: 'General Medicine',
      qualification: 'MBBS, MD',
      experience: 10,
      consultationFee: 500,
      slotDuration: 15,
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHours: { start: '09:00', end: '17:00' },
      breakTime: { start: '13:00', end: '14:00' },
      maxPatientsPerDay: 30,
      bio: 'Experienced general physician with 10 years of practice.',
      isAvailable: true,
    });
    await doctorProfile.save();
    console.log('✅ Doctor created: doctor@clinic.com');
  }

  // ── Create Demo Patient ──
  let patient = await User.findOne({ email: 'patient@clinic.com' });
  if (!patient) {
    patient = new User({
      name: 'Rahul Kumar',
      email: 'patient@clinic.com',
      phone: '+91 9876543213',
      password: 'patient123',
      role: 'patient',
    });
    await patient.save();
    console.log('✅ Patient created: patient@clinic.com');
  }

  return true;
}

module.exports = { seedDatabase };
