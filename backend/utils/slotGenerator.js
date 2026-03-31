const Slot = require('../models/Slot');
const Doctor = require('../models/Doctor');

/**
 * Generates time slots for a doctor on a given date
 * @param {string} doctorId
 * @param {string} date - YYYY-MM-DD
 */
async function generateDailySlots(doctorId, date) {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new Error('Doctor not found');

  const { start, end } = doctor.workingHours;
  const breakStart = doctor.breakTime?.start;
  const breakEnd = doctor.breakTime?.end;
  const duration = doctor.slotDuration || 15;

  // Delete existing unbooked slots for this date
  await Slot.deleteMany({ doctorId, date, isBooked: false });

  const slots = [];
  let current = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const breakStartMin = breakStart ? timeToMinutes(breakStart) : null;
  const breakEndMin = breakEnd ? timeToMinutes(breakEnd) : null;

  while (current + duration <= endMinutes) {
    // Skip break time
    if (breakStartMin && breakEndMin) {
      if (current >= breakStartMin && current < breakEndMin) {
        current = breakEndMin;
        continue;
      }
    }

    slots.push({
      doctorId,
      date,
      startTime: minutesToTime(current),
      endTime: minutesToTime(current + duration),
      isBooked: false,
      isBlocked: false,
    });

    current += duration;
  }

  const created = await Slot.insertMany(slots);
  return { count: created.length, slots: created };
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = { generateDailySlots };
