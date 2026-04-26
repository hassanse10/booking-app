const express  = require('express');
const pool     = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { generateMeetLink }  = require('../services/meetService');
const {
  sendBookingConfirmation,
  sendBookingUpdate,
  sendCancellation,
} = require('../services/emailService');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

const calcEndTime = (start_time, durationMins) => {
  const [h, m]  = start_time.split(':').map(Number);
  const total   = h * 60 + m + durationMins;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
};

const fetchStudent = (id) =>
  pool.query('SELECT * FROM students WHERE id=$1', [id]).then((r) => r.rows[0]);

// ── routes ───────────────────────────────────────────────────────────────────

// GET /api/bookings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isTeacher = req.user.role === 'teacher';
    const query = isTeacher
      ? `SELECT b.*, s.first_name, s.last_name, s.email, s.study_level
         FROM bookings b JOIN students s ON b.student_id = s.id
         ORDER BY b.date DESC, b.start_time DESC`
      : `SELECT b.*, s.first_name, s.last_name, s.email
         FROM bookings b JOIN students s ON b.student_id = s.id
         WHERE b.student_id = $1
         ORDER BY b.date DESC, b.start_time DESC`;

    const params = isTeacher ? [] : [req.user.id];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, s.first_name, s.last_name, s.email, s.study_level
       FROM bookings b JOIN students s ON b.student_id = s.id
       WHERE b.id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });

    const booking = rows[0];
    if (req.user.role === 'student' && booking.student_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/bookings  — student only
router.post('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Only students can book sessions' });

  const { date, start_time, duration } = req.body;
  if (!date || !start_time || !duration)
    return res.status(400).json({ error: 'date, start_time, duration required' });

  const durationMins = parseInt(duration);
  if (![60, 90, 120].includes(durationMins))
    return res.status(400).json({ error: 'Duration must be 60, 90, or 120' });

  const end_time = calcEndTime(start_time, durationMins);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock and check overlaps
    const overlap = await client.query(
      `SELECT id FROM bookings
       WHERE date=$1 AND status!='canceled'
         AND start_time < $3::time AND end_time > $2::time
       FOR UPDATE`,
      [date, start_time, end_time],
    );
    if (overlap.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Verify slot is within teacher availability
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const avail = await client.query(
      `SELECT id FROM availability
       WHERE day_of_week=$1 AND start_time<=$2::time AND end_time>=$3::time`,
      [dayOfWeek, start_time, end_time],
    );
    if (!avail.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected time is outside teacher availability' });
    }

    const meet_link = generateMeetLink();
    const { rows } = await client.query(
      `INSERT INTO bookings (student_id, date, start_time, duration, end_time, status, meet_link)
       VALUES ($1,$2,$3,$4,$5,'confirmed',$6) RETURNING *`,
      [req.user.id, date, start_time, durationMins, end_time, meet_link],
    );
    await client.query('COMMIT');

    const booking = rows[0];
    const student = await fetchStudent(req.user.id);
    sendBookingConfirmation(student, booking).catch(console.error);

    res.status(201).json(booking);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// PUT /api/bookings/:id  — student (own) or teacher
router.put('/:id', authenticateToken, async (req, res) => {
  const { date, start_time, duration } = req.body;
  if (!date || !start_time || !duration)
    return res.status(400).json({ error: 'date, start_time, duration required' });

  const durationMins = parseInt(duration);
  if (![60, 90, 120].includes(durationMins))
    return res.status(400).json({ error: 'Duration must be 60, 90, or 120' });

  const end_time = calcEndTime(start_time, durationMins);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [req.params.id],
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = existing.rows[0];

    if (req.user.role === 'student' && booking.student_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    if (booking.status === 'canceled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot modify a canceled booking' });
    }

    // Check overlaps (exclude self)
    const overlap = await client.query(
      `SELECT id FROM bookings
       WHERE date=$1 AND status!='canceled' AND id!=$4
         AND start_time < $3::time AND end_time > $2::time`,
      [date, start_time, end_time, req.params.id],
    );
    if (overlap.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Verify availability
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const avail = await client.query(
      `SELECT id FROM availability
       WHERE day_of_week=$1 AND start_time<=$2::time AND end_time>=$3::time`,
      [dayOfWeek, start_time, end_time],
    );
    if (!avail.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected time is outside teacher availability' });
    }

    const { rows } = await client.query(
      `UPDATE bookings
       SET date=$1, start_time=$2, duration=$3, end_time=$4,
           status='confirmed', updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [date, start_time, durationMins, end_time, req.params.id],
    );
    await client.query('COMMIT');

    const updated = rows[0];
    const student = await fetchStudent(booking.student_id);
    sendBookingUpdate(student, updated).catch(console.error);

    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to modify booking' });
  } finally {
    client.release();
  }
});

// DELETE /api/bookings/:id  — student (own) or teacher
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [req.params.id],
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = existing.rows[0];

    if (req.user.role === 'student' && booking.student_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied' });
    }
    if (booking.status === 'canceled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Booking already canceled' });
    }

    await client.query(
      "UPDATE bookings SET status='canceled', updated_at=NOW() WHERE id=$1",
      [req.params.id],
    );
    await client.query('COMMIT');

    const student = await fetchStudent(booking.student_id);
    sendCancellation(student, booking).catch(console.error);

    res.json({ message: 'Booking canceled' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  } finally {
    client.release();
  }
});

// POST /api/bookings/:id/notes  — teacher only
router.post('/:id/notes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher')
    return res.status(403).json({ error: 'Only teachers can add session notes' });

  const { teacher_notes, topics_covered, homework_assigned, next_focus_areas } = req.body;
  if (!teacher_notes)
    return res.status(400).json({ error: 'teacher_notes is required' });

  try {
    const { rows: bookingRows } = await pool.query(
      'SELECT * FROM bookings WHERE id=$1',
      [req.params.id]
    );
    if (!bookingRows.length)
      return res.status(404).json({ error: 'Booking not found' });

    // Update booking with teacher notes
    await pool.query(
      `UPDATE bookings SET teacher_notes=$1, updated_at=NOW() WHERE id=$2`,
      [teacher_notes, req.params.id]
    );

    // If other feedback fields provided, create/update session_feedback
    if (topics_covered || homework_assigned || next_focus_areas) {
      await pool.query(
        `INSERT INTO session_feedback (booking_id, student_id, topics_covered, homework_assigned, next_focus_areas)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (booking_id) DO UPDATE SET
         topics_covered = COALESCE($3, session_feedback.topics_covered),
         homework_assigned = COALESCE($4, session_feedback.homework_assigned),
         next_focus_areas = COALESCE($5, session_feedback.next_focus_areas)`,
        [req.params.id, bookingRows[0].student_id, topics_covered, homework_assigned, next_focus_areas]
      );
    }

    const { rows } = await pool.query(
      'SELECT * FROM bookings WHERE id=$1',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Add notes error:', err.message, err.code);
    res.status(500).json({ error: 'Failed to add notes', detail: err.message });
  }
});

// POST /api/bookings/:id/feedback  — student and teacher can provide feedback
router.post('/:id/feedback', authenticateToken, async (req, res) => {
  const { student_rating, teacher_rating, student_feedback, teacher_feedback } = req.body;

  try {
    const { rows: bookingRows } = await pool.query(
      'SELECT * FROM bookings WHERE id=$1',
      [req.params.id]
    );
    if (!bookingRows.length)
      return res.status(404).json({ error: 'Booking not found' });

    const booking = bookingRows[0];

    // Students can only provide student_rating/feedback, teachers can provide teacher_rating/feedback
    if (req.user.role === 'student' && booking.student_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    // Create or update session_feedback
    const { rows } = await pool.query(
      `INSERT INTO session_feedback (booking_id, student_id, student_rating, student_feedback, teacher_rating, teacher_feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (booking_id) DO UPDATE SET
       student_rating = COALESCE($3, session_feedback.student_rating),
       student_feedback = COALESCE($4, session_feedback.student_feedback),
       teacher_rating = COALESCE($5, session_feedback.teacher_rating),
       teacher_feedback = COALESCE($6, session_feedback.teacher_feedback),
       created_at = CASE WHEN session_feedback.created_at IS NULL THEN NOW() ELSE session_feedback.created_at END
       RETURNING *`,
      [req.params.id, booking.student_id, student_rating || null, student_feedback || null, teacher_rating || null, teacher_feedback || null]
    );

    // Also update bookings table with ratings
    if (student_rating) {
      await pool.query(
        'UPDATE bookings SET student_rating=$1, updated_at=NOW() WHERE id=$2',
        [student_rating, req.params.id]
      );
    }
    if (teacher_rating && req.user.role === 'teacher') {
      await pool.query(
        'UPDATE bookings SET teacher_rating=$1, updated_at=NOW() WHERE id=$2',
        [teacher_rating, req.params.id]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Add feedback error:', err.message, err.code);
    res.status(500).json({ error: 'Failed to add feedback', detail: err.message });
  }
});

// GET /api/bookings/:id/feedback  — get feedback for a booking
router.get('/:id/feedback', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM session_feedback WHERE booking_id=$1',
      [req.params.id]
    );

    if (rows.length) {
      res.json(rows[0]);
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error('Get feedback error:', err.message, err.code);
    res.status(500).json({ error: 'Failed to fetch feedback', detail: err.message });
  }
});

module.exports = router;
