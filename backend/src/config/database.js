/**
 * Database adapter:
 *   - Production (DATABASE_URL set)  →  pg Pool  (Neon / any PostgreSQL)
 *   - Local dev (no DATABASE_URL)    →  PGlite   (zero-install, file-based)
 */

// ── Production: real PostgreSQL via pg ────────────────────────────────────────
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },   // required by Neon / Render
  });

  pool.on('connect', () => console.log('PostgreSQL (Neon) connected'));
  pool.on('error',  (e) => console.error('PostgreSQL error:', e));

  module.exports = pool;

// ── Local dev: PGlite (no installation needed) ────────────────────────────────
} else {
  const path = require('path');
  const fs   = require('fs');

  const DATA_DIR = path.join(__dirname, '..', '..', 'pgdata');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let _dbPromise = null;

  const SCHEMA = `
    CREATE TABLE IF NOT EXISTS students (
      id            SERIAL       PRIMARY KEY,
      first_name    VARCHAR(100) NOT NULL,
      last_name     VARCHAR(100) NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      study_level   VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at    TIMESTAMPTZ  DEFAULT NOW()
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
    CREATE INDEX IF NOT EXISTS idx_bookings_date       ON bookings(date);
    CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);
  `;

  const initDb = async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(DATA_DIR);
    await db.waitReady;
    await db.exec(SCHEMA);

    const { rows } = await db.query('SELECT count(*) AS c FROM availability');
    if (parseInt(rows[0].c) === 0) {
      await db.exec(`
        INSERT INTO availability (day_of_week, start_time, end_time) VALUES
          (1,'09:00','18:00'),(2,'09:00','18:00'),(3,'09:00','18:00'),
          (4,'09:00','18:00'),(5,'09:00','17:00'),(6,'10:00','14:00')
        ON CONFLICT DO NOTHING;
      `);
      console.log('Seeded default availability (Mon–Sat)');
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
