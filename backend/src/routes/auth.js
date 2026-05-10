const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../config/database');

const router = express.Router();

const JWT_SECRET      = process.env.JWT_SECRET;
const TEACHER_EMAIL   = process.env.TEACHER_EMAIL;
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD;
const TEACHER_NAME    = process.env.TEACHER_NAME     || 'Ahmed Ben Ali';

if (!JWT_SECRET)       console.error('[STARTUP] JWT_SECRET is not set — authentication will fail');
if (!TEACHER_EMAIL)    console.error('[STARTUP] TEACHER_EMAIL is not set — teacher login will fail');
if (!TEACHER_PASSWORD) console.error('[STARTUP] TEACHER_PASSWORD is not set — teacher login will fail');

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { first_name, last_name, email, study_level, password } = req.body;

  if (!first_name || !last_name || !email || !study_level || !password)
    return res.status(400).json({ error: 'All fields are required' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const exists = await pool.query('SELECT id FROM students WHERE email = $1', [email]);
    if (exists.rows.length)
      return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO students (first_name, last_name, email, study_level, password_hash)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, first_name, last_name, email, study_level`,
      [first_name, last_name, email, study_level, password_hash],
    );

    const student = rows[0];
    const token = signToken({ id: student.id, email: student.email, role: 'student',
      first_name: student.first_name, last_name: student.last_name,
      study_level: student.study_level });

    res.status(201).json({ token, user: { ...student, role: 'student' } });
  } catch (err) {
    console.error('Register error:', err.message, err.code);
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  // Teacher login (hardcoded)
  if (email === TEACHER_EMAIL) {
    if (password !== TEACHER_PASSWORD)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: 0, email, role: 'teacher',
      first_name: TEACHER_NAME, last_name: '' });
    return res.json({ token, user: { id: 0, email, role: 'teacher',
      first_name: TEACHER_NAME, last_name: '' } });
  }

  // Student login
  try {
    const { rows } = await pool.query('SELECT * FROM students WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const student = rows[0];
    const valid   = await bcrypt.compare(password, student.password_hash);
    if (!valid)   return res.status(401).json({ error: 'Invalid credentials' });

    const { password_hash: _, ...safe } = student;
    const token = signToken({ id: safe.id, email: safe.email, role: 'student',
      first_name: safe.first_name, last_name: safe.last_name,
      study_level: safe.study_level });
    res.json({ token, user: { ...safe, role: 'student' } });
  } catch (err) {
    console.error('Login error:', err.message, err.code);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

module.exports = router;
