const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Middleware to ensure user is authenticated
router.use(authenticateToken);

// GET /api/students/me - Get current user profile + completion percentage
router.get('/me', async (req, res) => {
  try {
    const { id } = req.user;

    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, study_level, phone, bio,
              profile_picture_url, timezone, preferred_days, profile_completed_at, created_at
       FROM students WHERE id = $1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = rows[0];

    // Calculate profile completion percentage
    const requiredFields = ['first_name', 'last_name', 'email', 'study_level'];
    const optionalFields = ['phone', 'bio', 'profile_picture_url', 'timezone', 'preferred_days'];
    const allFields = [...requiredFields, ...optionalFields];

    let filledCount = 0;
    allFields.forEach(field => {
      if (student[field]) filledCount++;
    });

    const completionPercentage = Math.round((filledCount / allFields.length) * 100);

    res.json({
      ...student,
      completionPercentage,
      profileCompletedAt: student.profile_completed_at
    });
  } catch (err) {
    console.error('Get profile error:', err.message, err.code);
    res.status(500).json({ error: 'Failed to fetch profile', detail: err.message });
  }
});

// PUT /api/students/me - Update student profile
router.put('/me', async (req, res) => {
  try {
    const { id } = req.user;
    const { phone, bio, profile_picture_url, timezone, preferred_days } = req.body;

    // Update profile fields
    const updateFields = [];
    const updateValues = [id];
    let paramIndex = 2;

    if (phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      updateValues.push(phone);
    }
    if (bio !== undefined) {
      updateFields.push(`bio = $${paramIndex++}`);
      updateValues.push(bio);
    }
    if (profile_picture_url !== undefined) {
      updateFields.push(`profile_picture_url = $${paramIndex++}`);
      updateValues.push(profile_picture_url);
    }
    if (timezone !== undefined) {
      updateFields.push(`timezone = $${paramIndex++}`);
      updateValues.push(timezone);
    }
    if (preferred_days !== undefined) {
      updateFields.push(`preferred_days = $${paramIndex++}`);
      updateValues.push(preferred_days);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Check if profile is now complete (all required fields + at least 2 optional fields)
    const { rows: checkRows } = await pool.query(
      `SELECT first_name, last_name, email, study_level, phone, bio, profile_picture_url, timezone, preferred_days
       FROM students WHERE id = $1`,
      [id]
    );

    let profileCompletedAt = null;
    const student = checkRows[0];
    const optionalFields = [phone || student.phone, bio || student.bio, profile_picture_url || student.profile_picture_url, timezone || student.timezone, preferred_days || student.preferred_days];
    const filledOptional = optionalFields.filter(f => f).length;

    if (student.first_name && student.last_name && student.email && student.study_level && filledOptional >= 2) {
      profileCompletedAt = new Date();
      updateFields.push(`profile_completed_at = $${paramIndex}`);
      updateValues.push(profileCompletedAt);
    }

    const query = `UPDATE students SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(query, updateValues);

    const updatedStudent = rows[0];

    // Recalculate completion percentage
    const requiredFields = ['first_name', 'last_name', 'email', 'study_level'];
    const allOptionalFields = ['phone', 'bio', 'profile_picture_url', 'timezone', 'preferred_days'];
    const allFields = [...requiredFields, ...allOptionalFields];

    let filledCount = 0;
    allFields.forEach(field => {
      if (updatedStudent[field]) filledCount++;
    });

    const completionPercentage = Math.round((filledCount / allFields.length) * 100);

    res.json({
      ...updatedStudent,
      completionPercentage,
      profileCompletedAt: updatedStudent.profile_completed_at
    });
  } catch (err) {
    console.error('Update profile error:', err.message, err.code);
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});

// GET /api/students/:id/ratings - Get all ratings for a specific student
router.get('/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;
    const { minRating = 1, maxRating = 5 } = req.query;

    const { rows } = await pool.query(
      `SELECT sf.*, b.date, b.start_time, b.duration, s.first_name, s.last_name
       FROM session_feedback sf
       JOIN bookings b ON sf.booking_id = b.id
       JOIN students s ON b.student_id = s.id
       WHERE sf.student_id = $1 AND sf.teacher_rating >= $2 AND sf.teacher_rating <= $3
       ORDER BY b.date DESC`,
      [id, parseInt(minRating), parseInt(maxRating)]
    );

    res.json(rows);
  } catch (err) {
    console.error('Get ratings error:', err.message, err.code);
    res.status(500).json({ error: 'Failed to fetch ratings', detail: err.message });
  }
});

module.exports = router;
