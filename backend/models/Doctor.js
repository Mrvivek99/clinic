const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    qualification: {
      type: String,
      default: null,
      trim: true,
    },
    experience: {
      type: Number,
      default: 0,
    },
    consultationFee: {
      type: Number,
      default: 0,
    },
    slotDuration: {
      type: Number,
      default: 15, // minutes per slot
    },
    workingDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
    },
    breakTime: {
      start: { type: String, default: '13:00' },
      end: { type: String, default: '14:00' },
    },
    maxPatientsPerDay: {
      type: Number,
      default: 30,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    currentTokenServing: {
      type: Number,
      default: 0,
    },
    bio: {
      type: String,
      default: null,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
