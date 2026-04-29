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

    // ── Clean existing data ──
    await User.deleteMany({});
    await Doctor.deleteMany({});
    
    // ── Admin User ──
    const admin = new User({
      name: 'Admin User',
      email: 'admin@clinic.com',
      phone: '+91 9876543210',
      password: 'admin123',
      role: 'admin',
    });
    await admin.save();
    console.log('✅ Admin recreated: admin@clinic.com / admin123');

    // ── Doctor 1: Sharma ──
    const email1 = 'doctor@clinic.com';
    await User.deleteOne({ email: email1 });
    const doc1User = new User({
      name: 'Sharma',
      email: email1,
      phone: '+91 9876543211',
      password: 'doctor123',
      role: 'doctor',
    });
    await doc1User.save();
    
    await Doctor.deleteOne({ userId: doc1User._id });
    const doc1Profile = new Doctor({
      userId: doc1User._id,
      specialization: 'General Medicine',
      experience: 10,
      consultationFee: 500,
    });
    await doc1Profile.save();
    console.log(`✅ Doctor 1 recreated: ${email1} / doctor123`);

    // ── Doctor 2: Manish Patel ──
    const email2 = 'doctor2@clinic.com';
    await User.deleteOne({ email: email2 });
    const doc2User = new User({
      name: 'Manish Patel',
      email: email2,
      phone: '+91 9876543212',
      password: 'doctor123',
      role: 'doctor',
    });
    await doc2User.save();

    await Doctor.deleteOne({ userId: doc2User._id });
    const doc2Profile = new Doctor({
      userId: doc2User._id,
      specialization: 'Pediatrics',
      experience: 8,
      consultationFee: 400,
    });
    await doc2Profile.save();
    console.log(`✅ Doctor 2 recreated: ${email2} / doctor123`);

    // ── Doctor 3: M tries ──
    const email3 = 'doctor3@clinic.com';
    await User.deleteOne({ email: email3 });
    const doc3User = new User({
      name: 'M tries',
      email: email3,
      phone: '+91 9876543214',
      password: 'doctor123',
      role: 'doctor',
    });
    await doc3User.save();

    await Doctor.deleteOne({ userId: doc3User._id });
    const doc3Profile = new Doctor({
      userId: doc3User._id,
      specialization: 'General Physician',
      experience: 0,
      consultationFee: 500,
    });
    await doc3Profile.save();
    console.log(`✅ Doctor 3 recreated: ${email3} / doctor123`);

    // ── Demo Patient ──
    const pEmail = 'patient@clinic.com';
    await User.deleteOne({ email: pEmail });
    const patient = new User({
      name: 'Rahul Kumar',
      email: pEmail,
      phone: '+91 9876543213',
      password: 'patient123',
      role: 'patient',
    });
    await patient.save();
    console.log(`✅ Patient recreated: ${pEmail} / patient123`);

    console.log('\n🎉 ALL ACCOUNTS RECREATED SUCCESSFULLY!');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📦 Disconnected');
    process.exit(0);
  }
}

seed();
