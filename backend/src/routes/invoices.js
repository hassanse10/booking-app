const express = require('express');
const pool    = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// GET /api/invoices  — student sees own, teacher sees all
router.get('/', async (req, res) => {
  try {
    const isTeacher = req.user.role === 'teacher';
    const { rows } = await pool.query(
      `SELECT i.*, s.first_name, s.last_name, s.email
       FROM invoices i
       JOIN students s ON i.student_id = s.id
       ${isTeacher ? '' : 'WHERE i.student_id = $1'}
       ORDER BY i.issued_at DESC`,
      isTeacher ? [] : [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('Get invoices error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invoices', detail: err.message });
  }
});

// POST /api/invoices  — teacher only
router.post('/', async (req, res) => {
  if (req.user.role !== 'teacher')
    return res.status(403).json({ error: 'Only teachers can create invoices' });

  const { student_id, booking_id, amount, description, due_days = 14 } = req.body;
  if (!student_id || !amount)
    return res.status(400).json({ error: 'student_id and amount are required' });

  try {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + parseInt(due_days));

    const { rows } = await pool.query(
      `INSERT INTO invoices (student_id, booking_id, amount, description, due_at, status)
       VALUES ($1, $2, $3, $4, $5, 'sent') RETURNING *`,
      [student_id, booking_id || null, amount, description || null, dueAt],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create invoice error:', err.message);
    res.status(500).json({ error: 'Failed to create invoice', detail: err.message });
  }
});

// PATCH /api/invoices/:id/paid  — teacher marks as paid
router.patch('/:id/paid', async (req, res) => {
  if (req.user.role !== 'teacher')
    return res.status(403).json({ error: 'Only teachers can mark invoices as paid' });

  const { payment_method } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE invoices
       SET status='paid', paid_at=NOW(), payment_method=$2
       WHERE id=$1 RETURNING *`,
      [req.params.id, payment_method || 'cash'],
    );
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Mark paid error:', err.message);
    res.status(500).json({ error: 'Failed to update invoice', detail: err.message });
  }
});

module.exports = router;
