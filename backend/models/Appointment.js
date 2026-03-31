const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
    },
    slotTime: {
      type: String, // HH:MM format
      required: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['booked', 'in-progress', 'completed', 'missed', 'cancelled'],
      default: 'booked',
    },
    isEmergency: {
      type: Boolean,
      default: false,
    },
    symptoms: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    notes: {
      type: String, // Doctor's notes
      trim: true,
      maxlength: 1000,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    estimatedWaitMinutes: {
      type: Number,
      default: 0,
    },
    qrCode: {
      type: String, // Base64 QR code
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
appointmentSchema.index({ date: 1, doctorId: 1 });
appointmentSchema.index({ userId: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ tokenNumber: 1, date: 1, doctorId: 1 });

// Virtual for patient info
appointmentSchema.virtual('patient', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

module.exports = mongoose.model('Appointment', appointmentSchema);
