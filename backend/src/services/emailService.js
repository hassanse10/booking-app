const nodemailer = require('nodemailer');

const transporter = () =>
  nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

const fmtDateFR = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

const fmtTimeFR = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}`;
};

const fmtDurFR = (mins) =>
  ({ 60: '1 heure', 90: '1h 30min', 120: '2 heures' }[mins] || `${mins} min`);

const TEACHER_NAME = process.env.TEACHER_NAME || 'Ahmed Ben Ali';
const APP_URL      = process.env.FRONTEND_URL?.split(',')[0] || 'https://booking-app-silk-psi.vercel.app';

// ── Base HTML template (French) ───────────────────────────────────────────────
const bookingHtml = (student, booking, title, accentColor = '#667eea', extraBody = '') => `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,${accentColor},#764ba2);padding:32px;text-align:center;color:#fff}
  .hdr h1{margin:0;font-size:22px}
  .body{padding:32px}
  .row{display:flex;align-items:center;padding:12px 16px;background:#f8f9fa;border-radius:8px;margin:10px 0}
  .lbl{font-weight:700;color:#666;min-width:120px;font-size:13px}
  .val{color:#333;font-size:15px}
  .btn{display:block;text-align:center;padding:14px 28px;background:${accentColor};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:24px 0}
  .foot{padding:16px 32px;background:#f8f9fa;text-align:center;color:#888;font-size:12px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>${title}</h1></div>
  <div class="body">
    <p>Bonjour <strong>${student.first_name}</strong>,</p>
    <div class="row"><span class="lbl">📅 Date</span><span class="val">${fmtDateFR(booking.date)}</span></div>
    <div class="row"><span class="lbl">⏰ Heure</span><span class="val">${fmtTimeFR(booking.start_time)}</span></div>
    <div class="row"><span class="lbl">⏱ Durée</span><span class="val">${fmtDurFR(booking.duration)}</span></div>
    ${booking.meet_link ? `
    <div class="row"><span class="lbl">🔗 Lien</span><span class="val">${booking.meet_link}</span></div>
    <a href="${booking.meet_link}" class="btn">Rejoindre la Séance</a>` : ''}
    ${extraBody}
  </div>
  <div class="foot">Cours Particuliers avec ${TEACHER_NAME} — <a href="${APP_URL}">Gérer mes réservations</a></div>
</div></body></html>`;

const sendIfConfigured = async (mailOptions) => {
  if (!process.env.SMTP_USER) return;
  try {
    await transporter().sendMail(mailOptions);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

// ── Existing Emails (French) ──────────────────────────────────────────────────
const sendBookingConfirmation = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      student.email,
    cc:      process.env.TEACHER_EMAIL,
    subject: '✅ Séance confirmée — Détails',
    html:    bookingHtml(student, booking, '✅ Séance Confirmée'),
  });

const sendBookingUpdate = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      student.email,
    cc:      process.env.TEACHER_EMAIL,
    subject: '🔄 Séance reprogrammée — Nouveaux détails',
    html:    bookingHtml(student, booking, '🔄 Séance Reprogrammée', '#f093fb'),
  });

const sendCancellation = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      student.email,
    cc:      process.env.TEACHER_EMAIL,
    subject: '❌ Séance annulée',
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,#ff6b6b,#ee5a24);padding:32px;text-align:center;color:#fff}
  .hdr h1{margin:0}
  .body{padding:32px}
  .btn{display:block;text-align:center;padding:14px 28px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;margin:24px 0}
  .foot{padding:16px 32px;background:#f8f9fa;text-align:center;color:#888;font-size:12px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>❌ Séance Annulée</h1></div>
  <div class="body">
    <p>Bonjour <strong>${student.first_name}</strong>,</p>
    <p>Votre séance du <strong>${fmtDateFR(booking.date)}</strong> à <strong>${fmtTimeFR(booking.start_time)}</strong> a été annulée.</p>
    <p>Vous pouvez réserver une nouvelle séance depuis votre tableau de bord.</p>
    <a href="${APP_URL}" class="btn">Réserver une nouvelle séance</a>
  </div>
  <div class="foot">Cours Particuliers avec ${TEACHER_NAME}</div>
</div></body></html>`,
  });

// ── New Email Templates ───────────────────────────────────────────────────────

// 24h reminder
const send24hReminder = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      student.email,
    subject: `⏰ Rappel: Votre séance demain à ${fmtTimeFR(booking.start_time)}`,
    html: bookingHtml(student, booking, '⏰ Rappel — Séance Demain', '#f7971e',
      `<div style="background:#fff3cd;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #f7971e">
        <strong>🔔 Rappel automatique</strong><br>
        N'oubliez pas votre séance demain ! Cliquez sur le lien ci-dessus pour rejoindre.
      </div>`),
  });

// 1h reminder (existing cron)
const send1hReminder = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      student.email,
    subject: `⏰ Rappel: Votre séance commence dans 1 heure`,
    html:    bookingHtml(student, booking, '⏰ Séance dans 1 Heure', '#f7971e'),
  });

// No-show alert (to teacher)
const sendNoShowAlert = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      process.env.TEACHER_EMAIL,
    subject: `⚠️ Absence: ${student.first_name} ${student.last_name} — ${fmtDateFR(booking.date)}`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,#f7971e,#ffd200);padding:32px;text-align:center;color:#fff}
  .hdr h1{margin:0}
  .body{padding:32px}
  .row{display:flex;align-items:center;padding:12px 16px;background:#f8f9fa;border-radius:8px;margin:10px 0}
  .lbl{font-weight:700;color:#666;min-width:120px;font-size:13px}
  .val{color:#333;font-size:15px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>⚠️ Élève Absent</h1></div>
  <div class="body">
    <p>L'élève <strong>${student.first_name} ${student.last_name}</strong> ne s'est pas connecté à la séance.</p>
    <div class="row"><span class="lbl">📅 Date</span><span class="val">${fmtDateFR(booking.date)}</span></div>
    <div class="row"><span class="lbl">⏰ Heure</span><span class="val">${fmtTimeFR(booking.start_time)}</span></div>
    <div class="row"><span class="lbl">📧 Email</span><span class="val">${student.email}</span></div>
    <p style="margin-top:16px">Vous pouvez marquer cette séance comme absence depuis votre tableau de bord.</p>
  </div>
</div></body></html>`,
  });

// Feedback request (sent after session ends)
const sendFeedbackRequest = (student, booking) =>
  sendIfConfigured({
    from:    `"Cours Particuliers" <${process.env.SMTP_USER}>`,
    to:      student.email,
    subject: '⭐ Évaluez votre séance avec Ahmed',
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,#f7971e,#ffd200);padding:32px;text-align:center;color:#fff}
  .hdr h1{margin:0}
  .body{padding:32px;text-align:center}
  .stars{font-size:36px;letter-spacing:4px;margin:16px 0}
  .btn{display:inline-block;text-align:center;padding:14px 32px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:16px 0}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>⭐ Comment s'est passée votre séance ?</h1></div>
  <div class="body">
    <p>Bonjour <strong>${student.first_name}</strong>,</p>
    <p>Votre séance du <strong>${fmtDateFR(booking.date)}</strong> est terminée.</p>
    <div class="stars">★★★★★</div>
    <p>Vos retours nous aident à améliorer la qualité des cours.</p>
    <a href="${APP_URL}/dashboard" class="btn">Donner mon avis</a>
  </div>
</div></body></html>`,
  });

// ── Cron helpers ──────────────────────────────────────────────────────────────

// Called every hour — sends reminder 1h before session
const sendReminderEmails = async () => {
  if (!process.env.SMTP_USER) return;
  const pool = require('../config/database');

  const now       = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const today     = now.toISOString().split('T')[0];
  const nowTime   = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const laterTime = `${String(inOneHour.getHours()).padStart(2,'0')}:${String(inOneHour.getMinutes()).padStart(2,'0')}`;

  const result = await pool.query(
    `SELECT b.*, s.first_name, s.last_name, s.email
     FROM bookings b JOIN students s ON b.student_id = s.id
     WHERE b.date = $1 AND b.start_time BETWEEN $2::time AND $3::time AND b.status = 'confirmed'`,
    [today, nowTime, laterTime],
  );

  for (const row of result.rows) {
    await send1hReminder(row, row);
  }
  if (result.rows.length) console.log(`1h reminders sent: ${result.rows.length}`);
};

// Called daily at 6pm — sends reminder 24h before session
const send24hReminderEmails = async () => {
  if (!process.env.SMTP_USER) return;
  const pool = require('../config/database');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { rows } = await pool.query(
    `SELECT b.*, s.first_name, s.last_name, s.email
     FROM bookings b JOIN students s ON b.student_id = s.id
     WHERE DATE(b.date) = $1 AND b.status = 'confirmed'`,
    [tomorrowStr],
  );

  for (const booking of rows) {
    await send24hReminder(booking, booking);
    // Log to notifications table
    try {
      await pool.query(
        `INSERT INTO notifications (booking_id, student_id, type, recipient_email, sent_at, status)
         VALUES ($1, $2, '24h_reminder', $3, NOW(), 'sent')`,
        [booking.id, booking.student_id, booking.email],
      );
    } catch (e) {
      console.error('Notification log error:', e.message);
    }
  }
  if (rows.length) console.log(`24h reminders sent: ${rows.length}`);
};

// Called every 15 min — detect no-shows (15 min after session ended)
const detectAndNotifyNoShows = async () => {
  if (!process.env.SMTP_USER) return;
  const pool = require('../config/database');

  const now = new Date();
  const fifteenAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const today = now.toISOString().split('T')[0];
  const checkTime = `${String(fifteenAgo.getHours()).padStart(2,'0')}:${String(fifteenAgo.getMinutes()).padStart(2,'0')}`;

  const { rows } = await pool.query(
    `SELECT b.*, s.first_name, s.last_name, s.email
     FROM bookings b JOIN students s ON b.student_id = s.id
     WHERE b.date = $1 AND b.end_time = $2::time
       AND b.status = 'confirmed' AND b.no_show = FALSE`,
    [today, checkTime],
  );

  for (const booking of rows) {
    await pool.query(
      'UPDATE bookings SET no_show = TRUE, updated_at = NOW() WHERE id = $1',
      [booking.id],
    );
    await sendNoShowAlert(booking, booking);
    try {
      await pool.query(
        `INSERT INTO notifications (booking_id, student_id, type, recipient_email, sent_at, status)
         VALUES ($1, $2, 'no_show_alert', $3, NOW(), 'sent')`,
        [booking.id, booking.student_id, process.env.TEACHER_EMAIL],
      );
    } catch (e) {
      console.error('No-show notification log error:', e.message);
    }
  }
};

module.exports = {
  sendBookingConfirmation,
  sendBookingUpdate,
  sendCancellation,
  send24hReminder,
  send1hReminder,
  sendNoShowAlert,
  sendFeedbackRequest,
  sendReminderEmails,
  send24hReminderEmails,
  detectAndNotifyNoShows,
};
