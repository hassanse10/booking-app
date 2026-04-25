-- ============================================================
-- Teacher Booking System — Database Schema
-- Run: psql -U postgres -c "CREATE DATABASE teacher_booking;"
--      psql -U postgres -d teacher_booking -f database/schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  study_level   VARCHAR(100)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability (
  id           SERIAL  PRIMARY KEY,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME    NOT NULL,
  end_time     TIME    NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS bookings (
  id          SERIAL  PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date        DATE    NOT NULL,
  start_time  TIME    NOT NULL,
  duration    INTEGER NOT NULL CHECK (duration IN (60, 90, 120)),
  end_time    TIME    NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed', 'canceled')),
  meet_link   VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Safety net: no two active bookings can start at the exact same time on the same date
-- (full overlap detection is handled at the application layer with SELECT...FOR UPDATE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_no_exact_double_booking
  ON bookings (date, start_time)
  WHERE status != 'canceled';

CREATE INDEX IF NOT EXISTS idx_bookings_date       ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);

-- Sample availability: Mon–Fri 09:00–18:00, Sat 10:00–14:00
INSERT INTO availability (day_of_week, start_time, end_time) VALUES
  (1, '09:00', '18:00'),
  (2, '09:00', '18:00'),
  (3, '09:00', '18:00'),
  (4, '09:00', '18:00'),
  (5, '09:00', '17:00'),
  (6, '10:00', '14:00')
ON CONFLICT DO NOTHING;
