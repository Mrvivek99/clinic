/**
 * Database Seeder
 * Creates demo admin, doctor, and patient accounts
 * Run: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Doctor = require('./models/Doctor');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic_db';

async function seed() {
  console.log('🌱 Starting database seed...');
  console.log(`📦 Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

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
    } else {
      console.log('ℹ️  Admin already exists: admin@clinic.com');
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
      console.log('✅ Doctor user created: doctor@clinic.com / doctor123');
    } else {
      console.log('ℹ️  Doctor user already exists: doctor@clinic.com');
    }

    // ── Create Doctor Profile ──
    let doctorProfile = await Doctor.findOne({ userId: doctorUser._id });
    if (!doctorProfile) {
      doctorProfile = new Doctor({
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
      console.log('✅ Doctor profile created: Dr. Sharma — General Medicine');
    } else {
      console.log('ℹ️  Doctor profile already exists for Dr. Sharma');
    }

    // ── Create Second Doctor ──
    let doctor2User = await User.findOne({ email: 'doctor2@clinic.com' });
    if (!doctor2User) {
      doctor2User = new User({
        name: 'Dr. Patel',
        email: 'doctor2@clinic.com',
        phone: '+91 9876543212',
        password: 'doctor123',
        role: 'doctor',
      });
      await doctor2User.save();

      const doctor2Profile = new Doctor({
        userId: doctor2User._id,
        specialization: 'Pediatrics',
        qualification: 'MBBS, DCH',
        experience: 8,
        consultationFee: 400,
        slotDuration: 15,
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        workingHours: { start: '10:00', end: '18:00' },
        breakTime: { start: '13:00', end: '14:00' },
        maxPatientsPerDay: 25,
        bio: 'Child specialist with expertise in pediatric care.',
        isAvailable: true,
      });
      await doctor2Profile.save();
      console.log('✅ Doctor 2 created: Dr. Patel — Pediatrics (doctor2@clinic.com / doctor123)');
    } else {
      console.log('ℹ️  Doctor 2 already exists: doctor2@clinic.com');
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
        dateOfBirth: '1995-06-15',
        gender: 'male',
        bloodGroup: 'O+',
      });
      await patient.save();
      console.log('✅ Demo patient created: patient@clinic.com / patient123');
    } else {
      console.log('ℹ️  Demo patient already exists: patient@clinic.com');
    }

    console.log('\n🎉 Seeding complete! Demo credentials:');
    console.log('   Admin:   admin@clinic.com   / admin123');
    console.log('   Doctor:  doctor@clinic.com   / doctor123');
    console.log('   Doctor2: doctor2@clinic.com  / doctor123');
    console.log('   Patient: patient@clinic.com  / patient123');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected from MongoDB');
    process.exit(0);
  }
}

seed();
