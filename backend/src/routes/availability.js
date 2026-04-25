const express = require('express');
const pool    = require('../config/database');
const { authenticateToken, requireTeacher } = require('../middleware/auth');

const router = express.Router();

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// GET /api/availability  — public
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM availability ORDER BY day_of_week, start_time',
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// GET /api/availability/slots/:date?duration=60  — public
router.get('/slots/:date', async (req, res) => {
  const { date }         = req.params;
  const duration         = parseInt(req.query.duration) || 60;

  if (![60, 90, 120].includes(duration))
    return res.status(400).json({ error: 'Duration must be 60, 90, or 120' });

  try {
    const dateObj   = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    const availRes = await pool.query(
      'SELECT * FROM availability WHERE day_of_week = $1 ORDER BY start_time',
      [dayOfWeek],
    );
    if (!availRes.rows.length)
      return res.json({ slots: [], date, dayName: DAYS[dayOfWeek] });

    // Fetch confirmed/non-canceled bookings for that date
    const bookRes = await pool.query(
      `SELECT start_time, end_time FROM bookings
       WHERE date = $1 AND status != 'canceled'`,
      [date],
    );
    const booked = bookRes.rows.map((b) => ({
      start: b.start_time.substring(0, 5),
      end:   b.end_time.substring(0, 5),
    }));

    const slots = [];

    for (const avail of availRes.rows) {
      let [sH, sM] = avail.start_time.substring(0, 5).split(':').map(Number);
      const [eH, eM] = avail.end_time.substring(0, 5).split(':').map(Number);
      const endTotal  = eH * 60 + eM;

      while (sH * 60 + sM + duration <= endTotal) {
        const slotStart   = `${String(sH).padStart(2,'0')}:${String(sM).padStart(2,'0')}`;
        const slotEndMins = sH * 60 + sM + duration;
        const slotEnd     = `${String(Math.floor(slotEndMins/60)).padStart(2,'0')}:${String(slotEndMins%60).padStart(2,'0')}`;

        const conflict = booked.some(
          (b) => slotStart < b.end && slotEnd > b.start,
        );
        if (!conflict) slots.push({ start: slotStart, end: slotEnd });

        // Advance by 30-minute increments
        sM += 30;
        if (sM >= 60) { sM -= 60; sH += 1; }
      }
    }

    res.json({ slots, date, dayName: DAYS[dayOfWeek] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to calculate slots' });
  }
});

// POST /api/availability  — teacher only
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
  const { day_of_week, start_time, end_time } = req.body;

  if (day_of_week === undefined || !start_time || !end_time)
    return res.status(400).json({ error: 'day_of_week, start_time, end_time required' });

  if (start_time >= end_time)
    return res.status(400).json({ error: 'start_time must be before end_time' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO availability (day_of_week, start_time, end_time) VALUES ($1,$2,$3) RETURNING *',
      [day_of_week, start_time, end_time],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create availability' });
  }
});

// PUT /api/availability/:id  — teacher only
router.put('/:id', authenticateToken, requireTeacher, async (req, res) => {
  const { day_of_week, start_time, end_time } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE availability SET day_of_week=$1, start_time=$2, end_time=$3 WHERE id=$4 RETURNING *',
      [day_of_week, start_time, end_time, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// DELETE /api/availability/:id  — teacher only
router.delete('/:id', authenticateToken, requireTeacher, async (req, res) => {
  try {
    await pool.query('DELETE FROM availability WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
