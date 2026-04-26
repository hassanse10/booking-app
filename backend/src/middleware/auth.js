const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'teacher_booking_jwt_secret_key_2024_abc123xyz');
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher')
    return res.status(403).json({ error: 'Teacher access required' });
  next();
};

module.exports = { authenticateToken, requireTeacher };
