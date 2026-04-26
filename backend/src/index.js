require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');

const authRoutes         = require('./routes/auth');
const bookingRoutes      = require('./routes/bookings');
const availabilityRoutes = require('./routes/availability');
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
    // Allow requests with no origin (mobile, Postman, curl)
    if (!origin) return callback(null, true);
    // If no explicit allowlist, allow everything (dev/demo mode)
    if (allowedOrigins.length === 0) return callback(null, true);
    // Otherwise check the list
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth',         authRoutes);
app.use('/api/bookings',     bookingRoutes);
app.use('/api/availability', availabilityRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'OK' }));

// Reminder emails every hour (bonus feature)
cron.schedule('0 * * * *', () => {
  sendReminderEmails().catch((err) => console.error('Reminder cron error:', err));
});

app.listen(PORT, () => console.log(`Backend running → http://localhost:${PORT}`));
