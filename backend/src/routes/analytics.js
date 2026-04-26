const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to ensure teacher-only access
const requireTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can access analytics' });
  }
  next();
};

router.use(authenticateToken, requireTeacher);

// GET /api/analytics/revenue - Revenue metrics
router.get('/revenue', async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentYear = now.getFullYear();

    // Total earned this month
    const { rows: monthRows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM invoices
       WHERE status = 'paid' AND DATE_TRUNC('month', paid_at) = $1::date`,
      [`${currentMonth}-01`]
    );

    // Per-student breakdown
    const { rows: studentBreakdown } = await pool.query(
      `SELECT s.id, s.first_name, s.last_name,
              COUNT(b.id) as sessions,
              COALESCE(SUM(CASE WHEN b.duration = 60 THEN 15
                                WHEN b.duration = 90 THEN 18
                                WHEN b.duration = 120 THEN 25 END), 0) as estimated_earnings,
              COALESCE(AVG(b.student_rating), 0) as avg_rating
       FROM students s
       LEFT JOIN bookings b ON s.id = b.student_id AND b.status = 'confirmed'
       GROUP BY s.id, s.first_name, s.last_name
       ORDER BY estimated_earnings DESC
       LIMIT 10`
    );

    // Earnings over last 12 months
    const { rows: monthlyData } = await pool.query(
      `SELECT DATE_TRUNC('month', b.created_at) as month,
              COUNT(b.id) as sessions,
              COALESCE(SUM(CASE WHEN b.duration = 60 THEN 15
                                WHEN b.duration = 90 THEN 18
                                WHEN b.duration = 120 THEN 25 END), 0) as earnings
       FROM bookings b
       WHERE b.status = 'confirmed' AND b.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', b.created_at)
       ORDER BY month DESC`
    );

    res.json({
      thisMonth: monthRows[0].total,
      studentBreakdown,
      monthlyChart: monthlyData,
    });
  } catch (err) {
    console.error('Revenue analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch revenue analytics', detail: err.message });
  }
});

// GET /api/analytics/engagement - Engagement metrics
router.get('/engagement', async (req, res) => {
  try {
    // Most active students (by booking count)
    const { rows: mostActive } = await pool.query(
      `SELECT s.id, s.first_name, s.last_name, COUNT(b.id) as bookings
       FROM students s
       LEFT JOIN bookings b ON s.id = b.student_id AND b.status = 'confirmed'
       GROUP BY s.id
       ORDER BY bookings DESC
       LIMIT 5`
    );

    // Inactive students (no bookings in 30 days)
    const { rows: inactive } = await pool.query(
      `SELECT s.id, s.first_name, s.last_name,
              MAX(b.date) as last_booking
       FROM students s
       LEFT JOIN bookings b ON s.id = b.student_id AND b.status = 'confirmed'
       GROUP BY s.id
       HAVING MAX(b.date) < NOW() - INTERVAL '30 days' OR MAX(b.date) IS NULL
       ORDER BY MAX(b.date) DESC
       LIMIT 5`
    );

    // Average rating per student
    const { rows: ratings } = await pool.query(
      `SELECT s.id, s.first_name, s.last_name,
              COALESCE(AVG(sf.teacher_rating), 0) as avg_rating,
              COUNT(sf.id) as feedback_count
       FROM students s
       LEFT JOIN session_feedback sf ON s.id = sf.student_id AND sf.teacher_rating IS NOT NULL
       GROUP BY s.id
       HAVING COUNT(sf.id) > 0
       ORDER BY avg_rating DESC
       LIMIT 5`
    );

    // Cancellation rate
    const { rows: cancellationData } = await pool.query(
      `SELECT
              COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
              COUNT(*) FILTER (WHERE status = 'canceled') as canceled,
              ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'canceled') /
                    NULLIF(COUNT(*), 0), 2) as cancellation_rate
       FROM bookings`
    );

    // Average session duration
    const { rows: durationData } = await pool.query(
      `SELECT ROUND(AVG(duration)::numeric, 0) as avg_duration
       FROM bookings
       WHERE status = 'confirmed'`
    );

    res.json({
      mostActiveStudents: mostActive,
      inactiveStudents: inactive,
      topRatedStudents: ratings,
      bookingStats: {
        confirmed: parseInt(cancellationData[0].confirmed),
        canceled: parseInt(cancellationData[0].canceled),
        cancellationRate: parseFloat(cancellationData[0].cancellation_rate) || 0,
      },
      averageSessionDuration: parseInt(durationData[0].avg_duration) || 0,
    });
  } catch (err) {
    console.error('Engagement analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch engagement analytics', detail: err.message });
  }
});

// GET /api/analytics/peak-hours - Peak hours heatmap data
router.get('/peak-hours', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
              EXTRACT(DOW FROM date)::int as day_of_week,
              EXTRACT(HOUR FROM start_time)::int as hour,
              COUNT(*) as bookings
       FROM bookings
       WHERE status = 'confirmed'
       GROUP BY EXTRACT(DOW FROM date)::int, EXTRACT(HOUR FROM start_time)::int
       ORDER BY day_of_week, hour`
    );

    // Format as 7x24 heatmap (days 0-6, hours 0-23)
    const heatmap = Array(7).fill(null).map(() => Array(24).fill(0));
    rows.forEach(row => {
      if (row.day_of_week >= 0 && row.day_of_week <= 6 && row.hour >= 0 && row.hour <= 23) {
        heatmap[row.day_of_week][row.hour] = row.bookings;
      }
    });

    // Find peak hours
    let maxBookings = 0;
    const peakHours = [];
    heatmap.forEach((day, dayIdx) => {
      day.forEach((count, hourIdx) => {
        if (count > 0) {
          maxBookings = Math.max(maxBookings, count);
        }
      });
    });

    const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    heatmap.forEach((day, dayIdx) => {
      day.forEach((count, hourIdx) => {
        if (count > 0 && count === maxBookings) {
          peakHours.push({
            day: DAYS[dayIdx],
            hour: `${String(hourIdx).padStart(2, '0')}:00`,
            bookings: count,
          });
        }
      });
    });

    res.json({ heatmap, peakHours, maxBookings });
  } catch (err) {
    console.error('Peak hours analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch peak hours analytics', detail: err.message });
  }
});

// GET /api/analytics/conversion-funnel - Conversion metrics
router.get('/conversion-funnel', async (req, res) => {
  try {
    // Total registered students
    const { rows: totalRows } = await pool.query(
      'SELECT COUNT(*) as count FROM students'
    );

    // Students with >= 1 booking
    const { rows: oneBookingRows } = await pool.query(
      `SELECT COUNT(DISTINCT student_id) as count
       FROM bookings
       WHERE status = 'confirmed'`
    );

    // Students with >= 2 bookings
    const { rows: twoBookingsRows } = await pool.query(
      `SELECT COUNT(*) as count
       FROM (
         SELECT student_id, COUNT(*) as cnt
         FROM bookings
         WHERE status = 'confirmed'
         GROUP BY student_id
         HAVING COUNT(*) >= 2
       ) t`
    );

    // Students with recurring bookings
    const { rows: recurringRows } = await pool.query(
      'SELECT COUNT(DISTINCT student_id) as count FROM recurring_bookings WHERE active = TRUE'
    );

    const total = parseInt(totalRows[0].count);
    const oneBooking = parseInt(oneBookingRows[0].count);
    const twoBookings = parseInt(twoBookingsRows[0].count);
    const recurring = parseInt(recurringRows[0].count);

    res.json({
      funnel: [
        { stage: 'Élèves inscrits', count: total, percentage: 100 },
        { stage: 'Au moins 1 séance', count: oneBooking, percentage: total > 0 ? Math.round((oneBooking / total) * 100) : 0 },
        { stage: 'Au moins 2 séances', count: twoBookings, percentage: total > 0 ? Math.round((twoBookings / total) * 100) : 0 },
        { stage: 'Abonnement récurrent', count: recurring, percentage: total > 0 ? Math.round((recurring / total) * 100) : 0 },
      ],
    });
  } catch (err) {
    console.error('Conversion funnel error:', err.message);
    res.status(500).json({ error: 'Failed to fetch conversion funnel', detail: err.message });
  }
});

// GET /api/analytics/student-progress/:student_id - Individual student progress
router.get('/student-progress/:student_id', async (req, res) => {
  try {
    const { student_id } = req.params;

    // Student basic info
    const { rows: studentRows } = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [student_id]
    );

    if (!studentRows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRows[0];

    // Sessions attended
    const { rows: sessions } = await pool.query(
      `SELECT b.id, b.date, b.duration, b.student_rating,
              sf.topics_covered, sf.homework_assigned, sf.next_focus_areas
       FROM bookings b
       LEFT JOIN session_feedback sf ON b.id = sf.booking_id
       WHERE b.student_id = $1 AND b.status = 'confirmed'
       ORDER BY b.date DESC`,
      [student_id]
    );

    // Total hours
    const { rows: hoursRows } = await pool.query(
      `SELECT COALESCE(SUM(duration) / 60.0, 0) as total_hours
       FROM bookings
       WHERE student_id = $1 AND status = 'confirmed'`,
      [student_id]
    );

    // Average rating
    const { rows: ratingRows } = await pool.query(
      `SELECT COALESCE(AVG(student_rating), 0) as avg_rating
       FROM bookings
       WHERE student_id = $1 AND status = 'confirmed'`,
      [student_id]
    );

    // Progress timeline
    const { rows: timeline } = await pool.query(
      `SELECT b.id, b.date, COUNT(*) OVER (ORDER BY b.date) as session_number,
              ROUND(SUM(b.duration) OVER (ORDER BY b.date) / 60.0, 1) as cumulative_hours
       FROM bookings b
       WHERE b.student_id = $1 AND b.status = 'confirmed'
       ORDER BY b.date`,
      [student_id]
    );

    // Milestones
    const milestones = [];
    const sessionCount = sessions.filter(s => s.date).length;
    const totalHours = parseFloat(hoursRows[0].total_hours);

    if (sessionCount >= 5) milestones.push({ milestone: '5 séances réalisées', icon: '🏅', count: sessionCount });
    if (sessionCount >= 10) milestones.push({ milestone: '10 séances réalisées', icon: '🎉', count: sessionCount });
    if (totalHours >= 10) milestones.push({ milestone: '10 heures complétées', icon: '⏰', hours: totalHours });
    if (totalHours >= 20) milestones.push({ milestone: '20 heures complétées', icon: '🚀', hours: totalHours });

    res.json({
      student: {
        id: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        studyLevel: student.study_level,
      },
      stats: {
        sessionsAttended: sessions.length,
        totalHours: Math.round(totalHours * 10) / 10,
        averageRating: Math.round(parseFloat(ratingRows[0].avg_rating) * 10) / 10,
      },
      sessions,
      timeline,
      milestones,
    });
  } catch (err) {
    console.error('Student progress error:', err.message);
    res.status(500).json({ error: 'Failed to fetch student progress', detail: err.message });
  }
});

// GET /api/analytics/invoices-due - Overdue invoices
router.get('/invoices-due', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, s.first_name, s.last_name, s.email,
              CURRENT_DATE - i.due_at as days_overdue
       FROM invoices i
       JOIN students s ON i.student_id = s.id
       WHERE i.status IN ('sent', 'overdue') AND i.due_at < NOW()
       ORDER BY i.due_at ASC`
    );

    const totalOverdue = rows.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    res.json({
      totalOverdue,
      invoices: rows,
      count: rows.length,
    });
  } catch (err) {
    console.error('Invoices due error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoices due', detail: err.message });
  }
});

module.exports = router;
