const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic_db';

async function check() {
  await mongoose.connect(MONGODB_URI);
  const appointments = await Appointment.find({}).populate('doctorId');
  console.log('Total Appointments in DB:', appointments.length);
  for (const a of appointments) {
    console.log(`- Appt: ID=${a._id}, Date=${a.date}, Token=${a.tokenNumber}, Status=${a.status}, DoctorID=${a.doctorId?._id}, DoctorName=${a.doctorId?.specialization}`);
  }
  
  const today = new Date().toISOString().split('T')[0];
  console.log('Today is:', today);
  
  const doctor = await Doctor.findOne({}); 
  if (doctor) {
     console.log('Sample Doctor:', doctor._id, 'userId:', doctor.userId);
  }
  
  await mongoose.disconnect();
}
check();
