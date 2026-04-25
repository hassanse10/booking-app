const generateMeetLink = () => {
  // Jitsi Meet — free, real, no API key needed. Anyone can join instantly.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const rand  = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `https://meet.jit.si/TeacherSession-${rand(12)}`;
};

module.exports = { generateMeetLink };
