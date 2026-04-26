/**
 * Database adapter:
 *   - Production (DATABASE_URL set)  →  pg Pool  (Neon / any PostgreSQL)
 *   - Local dev (no DATABASE_URL)    →  PGlite   (zero-install, file-based)
 */

const TABLES = [
  `CREATE TABLE IF NOT EXISTS students (
    id                      SERIAL       PRIMARY KEY,
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100) NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    study_level             VARCHAR(100) NOT NULL,
    password_hash           VARCHAR(255) NOT NULL,
    phone                   VARCHAR(20),
    bio                     TEXT,
    profile_picture_url     VARCHAR(255),
    timezone                VARCHAR(50) DEFAULT 'UTC',
    preferred_days          VARCHAR(100),
    last_login              TIMESTAMPTZ,
    profile_completed_at    TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS availability (
    id           SERIAL  PRIMARY KEY,
    day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time   TIME    NOT NULL,
    end_time     TIME    NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id                  SERIAL  PRIMARY KEY,
    student_id          INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date                DATE    NOT NULL,
    start_time          TIME    NOT NULL,
    duration            INTEGER NOT NULL CHECK (duration IN (60, 90, 120)),
    end_time            TIME    NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                          CHECK (status IN ('confirmed', 'canceled')),
    meet_link           VARCHAR(255),
    teacher_notes       TEXT,
    student_notes       TEXT,
    student_rating      INTEGER CHECK (student_rating BETWEEN 1 AND 5),
    teacher_rating      INTEGER CHECK (teacher_rating BETWEEN 1 AND 5),
    student_feedback    TEXT,
    teacher_feedback    TEXT,
    amount_paid         DECIMAL(10, 2) DEFAULT 0,
    payment_status      VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    invoice_id          INTEGER,
    cancelled_reason    TEXT,
    student_joined_at   TIMESTAMPTZ,
    teacher_joined_at   TIMESTAMPTZ,
    no_show             BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    booking_id      INTEGER REFERENCES bookings(id),
    amount          DECIMAL(10, 2) NOT NULL,
    description     TEXT,
    issued_at       TIMESTAMPTZ DEFAULT NOW(),
    due_at          TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    payment_method  VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id              SERIAL PRIMARY KEY,
    booking_id      INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL CHECK (type IN ('24h_reminder', 'cancellation', 'rescheduled', 'no_show_alert', 'payment_reminder')),
    recipient_email VARCHAR(255),
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    status          VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    error_message   TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS recurring_bookings (
    id              SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    frequency       VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    start_date      DATE NOT NULL,
    end_date        DATE,
    day_of_week     INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    time            TIME NOT NULL,
    duration        INTEGER NOT NULL CHECK (duration IN (60, 90, 120)),
    active          BOOLEAN DEFAULT TRUE,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS session_feedback (
    id              SERIAL PRIMARY KEY,
    booking_id      INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(id),
    teacher_rating  INTEGER CHECK (teacher_rating BETWEEN 1 AND 5),
    student_rating  INTEGER CHECK (student_rating BETWEEN 1 AND 5),
    student_feedback TEXT,
    teacher_feedback TEXT,
    topics_covered  TEXT,
    homework_assigned TEXT,
    next_focus_areas TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_date       ON bookings(date)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_student_id ON invoices(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_booking_id ON notifications(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_bookings_student_id ON recurring_bookings(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_session_feedback_booking_id ON session_feedback(booking_id)`,
];

// ── Production: real PostgreSQL via pg ────────────────────────────────────────
if (process.env.DATABASE_URL) {
  const { Pool }   = require('pg');
  const bcrypt     = require('bcryptjs');

  // Strip channel_binding — not supported by all pg versions
  const rawUrl  = process.env.DATABASE_URL;
  const cleanUrl = rawUrl
    .replace(/[&?]channel_binding=[^&]*/g, '')
    .replace(/\?&/, '?');

  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    idleTimeoutMillis:      240000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('connect', () => console.log('PostgreSQL (Neon) connected'));
  pool.on('error',  (e) => console.error('PostgreSQL pool error:', e.message));

  // Run schema + seed on startup
  (async () => {
    try {
      // Create tables one by one (pg doesn't support multi-statement queries)
      for (const sql of TABLES) {
        await pool.query(sql);
      }
      console.log('Schema ready');

      // Seed availability if empty
      const { rows: avRows } = await pool.query('SELECT COUNT(*) AS c FROM availability');
      if (parseInt(avRows[0].c) === 0) {
        await pool.query(`
          INSERT INTO availability (day_of_week, start_time, end_time) VALUES
            (1,'09:00','18:00'),(2,'09:00','18:00'),(3,'09:00','18:00'),
            (4,'09:00','18:00'),(5,'09:00','17:00'),(6,'10:00','14:00')
          ON CONFLICT DO NOTHING
        `);
        console.log('Seeded availability (Lun–Sam)');
      }

      // Seed demo student if no students exist
      const { rows: stRows } = await pool.query('SELECT COUNT(*) AS c FROM students');
      if (parseInt(stRows[0].c) === 0) {
        const hash = await bcrypt.hash('demo1234', 12);
        await pool.query(
          `INSERT INTO students (first_name, last_name, email, study_level, password_hash)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
          ['Sara', 'Dupont', 'sara.dupont@cours.fr', 'Terminale', hash],
        );
        console.log('Seeded demo student: sara.dupont@cours.fr / demo1234');
      }
    } catch (e) {
      console.error('DB init error:', e.message);
    }
  })();

  module.exports = pool;

// ── Local dev: PGlite (no installation needed) ────────────────────────────────
} else {
  const path = require('path');
  const fs   = require('fs');

  const DATA_DIR = path.join(__dirname, '..', '..', 'pgdata');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let _dbPromise = null;

  const initDb = async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(DATA_DIR);
    await db.waitReady;

    for (const sql of TABLES) await db.exec(sql);

    const { rows } = await db.query('SELECT count(*) AS c FROM availability');
    if (parseInt(rows[0].c) === 0) {
      await db.exec(`
        INSERT INTO availability (day_of_week, start_time, end_time) VALUES
          (1,'09:00','18:00'),(2,'09:00','18:00'),(3,'09:00','18:00'),
          (4,'09:00','18:00'),(5,'09:00','17:00'),(6,'10:00','14:00')
        ON CONFLICT DO NOTHING;
      `);
    }
    console.log('PostgreSQL (PGlite) ready →', DATA_DIR);
    return db;
  };

  const getDb = () => {
    if (!_dbPromise) _dbPromise = initDb();
    return _dbPromise;
  };

  module.exports = {
    query:   async (sql, params = []) => { const db = await getDb(); return db.query(sql, params); },
    connect: async () => {
      const db = await getDb();
      return {
        query: async (sql, params = []) => {
          const cmd = sql.trim().toUpperCase().replace(/\s+/g, ' ');
          if (cmd === 'BEGIN')    { await db.exec('BEGIN');    return { rows: [] }; }
          if (cmd === 'COMMIT')   { await db.exec('COMMIT');   return { rows: [] }; }
          if (cmd === 'ROLLBACK') { try { await db.exec('ROLLBACK'); } catch (_) {} return { rows: [] }; }
          return db.query(sql, params);
        },
        release: () => {},
      };
    },
  };
}
