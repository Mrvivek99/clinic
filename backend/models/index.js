/**
 * Central model exports
 * All models use Mongoose with MongoDB
 */
const User = require('./User');
const Doctor = require('./Doctor');
const Slot = require('./Slot');
const Appointment = require('./Appointment');

module.exports = { User, Doctor, Slot, Appointment };
