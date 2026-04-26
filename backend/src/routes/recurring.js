const express = require('express');
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateMeetLink }  = require('../services/meetService');
const { sendBookingConfirmation } = require('../services/emailService');

const router = express.Router();
router.use(authenticateToken);

const calcEndTime = (start_time, durationMins) => {
  const [h, m] = start_time.split(':').map(Number);
  const total  = h * 60 + m + durationMins;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
};

// ── Waitlist table bootstrap (created lazily if missing) ─────────────────────
const ensureWaitlistTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id          SERIAL PRIMARY KEY,
      student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      date        DATE    NOT NULL,
      start_time  TIME    NOT NULL,
      duration    INTEGER NOT NULL CHECK (duration IN (60, 90, 120)),
      notified    BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (student_id, date, start_time)
    )
  `);
};

// ── Recurring Bookings ────────────────────────────────────────────────────────

// POST /api/recurring  — student only
router.post('/', async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Only students can create recurring bookings' });

  const { frequency, start_date, day_of_week, time, duration, weeks = 4 } = req.body;
  if (!frequency || !start_date || day_of_week === undefined || !time || !duration)
    return res.status(400).json({ error: 'frequency, start_date, day_of_week, time, duration required' });

  const durationMins = parseInt(duration);
  if (![60, 90, 120].includes(durationMins))
    return res.status(400).json({ error: 'Duration must be 60, 90, or 120' });

  const discountMap = { weekly: 10, biweekly: 5, monthly: 0 };
  const discount    = discountMap[frequency] ?? 0;

  try {
    // Save the recurring booking config
    const { rows } = await pool.query(
      `INSERT INTO recurring_bookings
         (student_id, frequency, start_date, day_of_week, time, duration, discount_percent)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, frequency, start_date, day_of_week, time, durationMins, discount],
    );
    const recurring = rows[0];

    // Generate actual bookings for the next N weeks
    const created = [];
    const errors  = [];
    const startDate = new Date(start_date + 'T00:00:00');

    for (let w = 0; w < parseInt(weeks); w++) {
      const bookingDate = new Date(startDate);
      const diff = (day_of_week - startDate.getDay() + 7) % 7;
      bookingDate.setDate(startDate.getDate() + diff + w * 7);
      const dateStr  = bookingDate.toISOString().split('T')[0];
      const end_time = calcEndTime(time, durationMins);

      // Check for conflicts
      const { rows: conflict } = await pool.query(
        `SELECT id FROM bookings WHERE date=$1 AND status!='canceled'
           AND start_time < $3::time AND end_time > $2::time`,
        [dateStr, time, end_time],
      );
      if (conflict.length) { errors.push(dateStr); continue; }

      // Check availability
      const dayNum = new Date(dateStr + 'T00:00:00').getDay();
      const { rows: avail } = await pool.query(
        `SELECT id FROM availability
         WHERE day_of_week=$1 AND start_time<=$2::time AND end_time>=$3::time`,
        [dayNum, time, end_time],
      );
      if (!avail.length) { errors.push(dateStr); continue; }

      const meet_link = generateMeetLink();
      const { rows: booking } = await pool.query(
        `INSERT INTO bookings (student_id, date, start_time, duration, end_time, status, meet_link)
         VALUES ($1,$2,$3,$4,$5,'confirmed',$6) RETURNING *`,
        [req.user.id, dateStr, time, durationMins, end_time, meet_link],
      );
      created.push(booking[0]);
    }

    // Send confirmation for first session
    if (created.length > 0) {
      const { rows: studentRows } = await pool.query('SELECT * FROM students WHERE id=$1', [req.user.id]);
      if (studentRows.length) sendBookingConfirmation(studentRows[0], created[0]).catch(console.error);
    }

    res.status(201).json({
      recurring,
      bookingsCreated: created.length,
      bookingsFailed:  errors.length,
      failedDates:     errors,
      firstBookings:   created.slice(0, 4),
      discount: `${discount}%`,
    });
  } catch (err) {
    console.error('Recurring booking error:', err.message);
    res.status(500).json({ error: 'Failed to create recurring booking', detail: err.message });
  }
});

// GET /api/recurring  — get my recurring bookings
router.get('/', async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.id : null;
    const { rows } = await pool.query(
      `SELECT * FROM recurring_bookings
       WHERE ($1::int IS NULL OR student_id = $1) AND active = TRUE
       ORDER BY created_at DESC`,
      [studentId],
    );
    res.json(rows);
  } catch (err) {
    console.error('Get recurring error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recurring bookings', detail: err.message });
  }
});

// DELETE /api/recurring/:id  — cancel recurring
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM recurring_bookings WHERE id=$1', [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'student' && rows[0].student_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    await pool.query(
      'UPDATE recurring_bookings SET active=FALSE WHERE id=$1', [req.params.id],
    );
    res.json({ message: 'Recurring booking cancelled' });
  } catch (err) {
    console.error('Cancel recurring error:', err.message);
    res.status(500).json({ error: 'Failed to cancel', detail: err.message });
  }
});

// ── Waitlist ──────────────────────────────────────────────────────────────────

// POST /api/recurring/waitlist  — join waitlist for a slot
router.post('/waitlist', async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Only students can join the waitlist' });

  const { date, start_time, duration } = req.body;
  if (!date || !start_time || !duration)
    return res.status(400).json({ error: 'date, start_time, duration required' });

  try {
    await ensureWaitlistTable();

    const { rows } = await pool.query(
      `INSERT INTO waitlist (student_id, date, start_time, duration)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (student_id, date, start_time) DO NOTHING
       RETURNING *`,
      [req.user.id, date, start_time, parseInt(duration)],
    );

    // Position in waitlist
    const { rows: pos } = await pool.query(
      `SELECT COUNT(*) AS position FROM waitlist
       WHERE date=$1 AND start_time=$2::time AND notified=FALSE`,
      [date, start_time],
    );

    res.status(201).json({
      message: 'Ajouté à la liste d\'attente',
      position: parseInt(pos[0].position),
      entry: rows[0] ?? null,
    });
  } catch (err) {
    console.error('Waitlist error:', err.message);
    res.status(500).json({ error: 'Failed to join waitlist', detail: err.message });
  }
});

// GET /api/recurring/waitlist  — teacher sees all waitlisted slots
router.get('/waitlist', async (req, res) => {
  try {
    await ensureWaitlistTable();
    const { rows } = await pool.query(
      `SELECT w.*, s.first_name, s.last_name, s.email
       FROM waitlist w JOIN students s ON w.student_id = s.id
       WHERE w.notified = FALSE
       ORDER BY w.date, w.start_time, w.created_at`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Get waitlist error:', err.message);
    res.status(500).json({ error: 'Failed to fetch waitlist', detail: err.message });
  }
});

module.exports = router;
