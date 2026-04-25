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

app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
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
