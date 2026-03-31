const express = require('express');
const router = express.Router();
const Slot = require('../models/Slot');
const { auth } = require('../middleware/auth');
const { generateDailySlots } = require('../utils/slotGenerator');

// @route  GET /api/slots
// @desc   Get available slots for a doctor on a date
// @access Private
router.get('/', auth, async (req, res) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return res.status(400).json({ error: 'doctorId and date are required.' });
  }

  try {
    let slots = await Slot.find({ doctorId, date }).sort({ startTime: 1 });

    // Auto-generate slots if none exist
    if (slots.length === 0) {
      const result = await generateDailySlots(doctorId, date);
      slots = result.slots;
    }

    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
