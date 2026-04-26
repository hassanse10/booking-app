require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const bcrypt  = require('bcryptjs');

const authRoutes         = require('./routes/auth');
const bookingRoutes      = require('./routes/bookings');
const availabilityRoutes = require('./routes/availability');
const studentsRoutes     = require('./routes/students');
const analyticsRoutes    = require('./routes/analytics');
const pool               = require('./config/database');
const { sendReminderEmails } = require('./services/emailService');

const app  = express();
const PORT = process.env.PORT || 5000;

// Accept FRONTEND_URL (comma-separated list) or fall back to allowing all origins
const rawOrigins = process.env.FRONTEND_URL || '';
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth',         authRoutes);
app.use('/api/bookings',     bookingRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/students',     studentsRoutes);
app.use('/api/analytics',    analyticsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'OK' }));

// ── Demo account keep-alive ───────────────────────────────────────────────────
// Neon free tier can wipe data after inactivity. This re-seeds the demo
// student and availability slots every 30 minutes automatically.
const seedDemo = async () => {
  try {
    // Re-seed demo student if missing
    const { rows } = await pool.query(
      'SELECT id FROM students WHERE email = $1',
      ['sara.dupont@cours.fr'],
    );
    if (!rows.length) {
      const hash = await bcrypt.hash('demo1234', 10);
      await pool.query(
        `INSERT INTO students (first_name, last_name, email, study_level, password_hash)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING`,
        ['Sara', 'Dupont', 'sara.dupont@cours.fr', 'Terminale', hash],
      );
      console.log('Demo student re-seeded');
    }

    // Re-seed availability if missing
    const { rows: av } = await pool.query('SELECT COUNT(*) AS c FROM availability');
    if (parseInt(av[0].c) === 0) {
      await pool.query(`
        INSERT INTO availability (day_of_week, start_time, end_time) VALUES
          (1,'09:00','18:00'),(2,'09:00','18:00'),(3,'09:00','18:00'),
          (4,'09:00','18:00'),(5,'09:00','17:00'),(6,'10:00','14:00')
        ON CONFLICT DO NOTHING
      `);
      console.log('Availability re-seeded');
    }
  } catch (e) {
    console.error('Seed error:', e.message);
  }
};

// Run seed on startup and every 30 minutes
seedDemo();
cron.schedule('*/30 * * * *', seedDemo);

// Reminder emails every hour
cron.schedule('0 * * * *', () => {
  sendReminderEmails().catch((err) => console.error('Reminder cron error:', err));
});

app.listen(PORT, () => console.log(`Backend running → http://localhost:${PORT}`));
