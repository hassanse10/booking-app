const nodemailer = require('nodemailer');

const transporter = () =>
  nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

const fmtTime = (t) => {
  const [h, m] = t.substring(0, 5).split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${ap}`;
};

const fmtDur = (mins) =>
  ({ 60: '1 hour', 90: '1 h 30 min', 120: '2 hours' }[mins] || `${mins} min`);

const bookingHtml = (student, booking, title, accentColor = '#667eea') => `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,${accentColor},#764ba2);padding:32px;text-align:center;color:#fff}
  .hdr h1{margin:0;font-size:22px}
  .body{padding:32px}
  .row{display:flex;align-items:center;padding:12px 16px;background:#f8f9fa;border-radius:8px;margin:10px 0}
  .lbl{font-weight:700;color:#666;min-width:110px;font-size:13px}
  .val{color:#333;font-size:15px}
  .btn{display:block;text-align:center;padding:14px 28px;background:${accentColor};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:24px 0}
  .foot{padding:16px 32px;background:#f8f9fa;text-align:center;color:#888;font-size:12px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>${title}</h1></div>
  <div class="body">
    <p>Hi <strong>${student.first_name}</strong>,</p>
    <div class="row"><span class="lbl">📅 Date</span><span class="val">${fmtDate(booking.date)}</span></div>
    <div class="row"><span class="lbl">⏰ Time</span><span class="val">${fmtTime(booking.start_time)}</span></div>
    <div class="row"><span class="lbl">⏱ Duration</span><span class="val">${fmtDur(booking.duration)}</span></div>
    ${booking.meet_link ? `
    <div class="row"><span class="lbl">🔗 Meet</span><span class="val">${booking.meet_link}</span></div>
    <a href="${booking.meet_link}" class="btn">Join Google Meet</a>` : ''}
  </div>
  <div class="foot">Teacher Booking System — manage bookings from your dashboard.</div>
</div></body></html>`;

const sendIfConfigured = async (mailOptions) => {
  if (!process.env.SMTP_USER) return;
  await transporter().sendMail(mailOptions);
};

const sendBookingConfirmation = (student, booking) =>
  sendIfConfigured({
    from:    `"Teacher Booking" <${process.env.SMTP_USER}>`,
    to:      student.email,
    cc:      process.env.TEACHER_EMAIL,
    subject: '✅ Booking Confirmed — Session Details',
    html:    bookingHtml(student, booking, '✅ Booking Confirmed'),
  });

const sendBookingUpdate = (student, booking) =>
  sendIfConfigured({
    from:    `"Teacher Booking" <${process.env.SMTP_USER}>`,
    to:      student.email,
    cc:      process.env.TEACHER_EMAIL,
    subject: '🔄 Booking Rescheduled — New Details',
    html:    bookingHtml(student, booking, '🔄 Booking Rescheduled', '#f093fb'),
  });

const sendCancellation = (student, booking) =>
  sendIfConfigured({
    from:    `"Teacher Booking" <${process.env.SMTP_USER}>`,
    to:      student.email,
    cc:      process.env.TEACHER_EMAIL,
    subject: '❌ Booking Canceled',
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)}
  .hdr{background:linear-gradient(135deg,#ff6b6b,#ee5a24);padding:32px;text-align:center;color:#fff}
  .hdr h1{margin:0}
  .body{padding:32px}
</style></head><body>
<div class="wrap">
  <div class="hdr"><h1>❌ Booking Canceled</h1></div>
  <div class="body">
    <p>Hi <strong>${student.first_name}</strong>,</p>
    <p>Your session on <strong>${fmtDate(booking.date)}</strong> at
       <strong>${fmtTime(booking.start_time)}</strong> has been canceled.</p>
    <p>You can book a new session anytime from your dashboard.</p>
  </div>
</div></body></html>`,
  });

// Called by cron — sends reminder 1 hour before session
const sendReminderEmails = async () => {
  if (!process.env.SMTP_USER) return;
  const pool = require('../config/database');

  const now         = new Date();
  const inOneHour   = new Date(now.getTime() + 60 * 60 * 1000);
  const todayDate   = now.toISOString().split('T')[0];
  const nowTime     = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const laterTime   = `${String(inOneHour.getHours()).padStart(2,'0')}:${String(inOneHour.getMinutes()).padStart(2,'0')}`;

  const result = await pool.query(
    `SELECT b.*, s.first_name, s.last_name, s.email
     FROM bookings b JOIN students s ON b.student_id = s.id
     WHERE b.date = $1 AND b.start_time BETWEEN $2 AND $3 AND b.status = 'confirmed'`,
    [todayDate, nowTime, laterTime],
  );

  for (const row of result.rows) {
    await sendIfConfigured({
      from:    `"Teacher Booking" <${process.env.SMTP_USER}>`,
      to:      row.email,
      subject: '⏰ Reminder: Your session starts in 1 hour!',
      html:    bookingHtml(row, row, '⏰ Session Reminder — 1 Hour Away', '#f7971e'),
    });
  }
};

module.exports = {
  sendBookingConfirmation,
  sendBookingUpdate,
  sendCancellation,
  sendReminderEmails,
};
