# Teacher Booking System — MVP

A full-stack web app where students can book sessions with a teacher.
Built with React + Tailwind, Node.js + Express, PostgreSQL.

---

## Project Structure

```
booking-app/
├── backend/              ← Express API (port 5000)
│   ├── src/
│   │   ├── config/database.js
│   │   ├── middleware/auth.js
│   │   ├── routes/auth.js
│   │   ├── routes/bookings.js
│   │   ├── routes/availability.js
│   │   ├── services/emailService.js
│   │   ├── services/meetService.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── frontend/             ← React + Vite app (port 5173)
│   ├── src/
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/Login.jsx
│   │   ├── pages/Register.jsx
│   │   ├── pages/StudentDashboard.jsx
│   │   ├── pages/TeacherDashboard.jsx
│   │   ├── services/api.js
│   │   └── App.jsx
│   └── package.json
└── database/schema.sql   ← PostgreSQL schema
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

---

## Setup Instructions

### 1 — Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE teacher_booking;"

# Run the schema (creates tables + sample availability Mon–Sat)
psql -U postgres -d teacher_booking -f database/schema.sql
```

### 2 — Backend

```bash
cd backend

# Copy and fill in your environment variables
cp .env.example .env
```

Edit `backend/.env`:

| Variable          | Description                              | Example                        |
|-------------------|------------------------------------------|--------------------------------|
| `DB_HOST`         | PostgreSQL host                          | `localhost`                    |
| `DB_PORT`         | PostgreSQL port                          | `5432`                         |
| `DB_NAME`         | Database name                            | `teacher_booking`              |
| `DB_USER`         | PostgreSQL username                      | `postgres`                     |
| `DB_PASSWORD`     | PostgreSQL password                      | `yourpassword`                 |
| `JWT_SECRET`      | Secret key for JWT tokens                | any long random string         |
| `TEACHER_EMAIL`   | Teacher login email (hardcoded admin)    | `teacher@example.com`          |
| `TEACHER_PASSWORD`| Teacher login password                   | `teacher123`                   |
| `TEACHER_NAME`    | Teacher display name                     | `Ahmed Ben Ali`                |
| `SMTP_USER`       | Gmail address for sending emails         | `you@gmail.com` *(optional)*   |
| `SMTP_PASS`       | Gmail App Password                       | *(optional — skip to disable)* |

> **Email is optional.** If `SMTP_USER` is empty, all booking/email logic still works — emails are just skipped silently.

```bash
# Install dependencies
npm install

# Start the server (development)
npm run dev

# Or for production
npm start
```

Backend runs at: **http://localhost:5000**

### 3 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

The Vite dev server proxies `/api/*` requests to the backend automatically.

---

## Login Credentials

### Teacher (Admin)
Use whatever you set in `backend/.env`:
- Email: `TEACHER_EMAIL`
- Password: `TEACHER_PASSWORD`

### Students
Students self-register via the `/register` page.

---

## API Reference

### Auth
| Method | Path                  | Access | Description          |
|--------|-----------------------|--------|----------------------|
| POST   | `/api/auth/register`  | Public | Register a student   |
| POST   | `/api/auth/login`     | Public | Login (any role)     |

### Bookings
| Method | Path                  | Access          | Description           |
|--------|-----------------------|-----------------|-----------------------|
| GET    | `/api/bookings`       | Auth            | List bookings (own/all) |
| GET    | `/api/bookings/:id`   | Auth            | Get single booking    |
| POST   | `/api/bookings`       | Student         | Create booking        |
| PUT    | `/api/bookings/:id`   | Student/Teacher | Modify booking        |
| DELETE | `/api/bookings/:id`   | Student/Teacher | Cancel booking        |

### Availability
| Method | Path                             | Access  | Description              |
|--------|----------------------------------|---------|--------------------------|
| GET    | `/api/availability`              | Public  | List all availability    |
| GET    | `/api/availability/slots/:date`  | Public  | Get slots for a date     |
| POST   | `/api/availability`              | Teacher | Add availability slot    |
| PUT    | `/api/availability/:id`          | Teacher | Update availability slot |
| DELETE | `/api/availability/:id`          | Teacher | Delete availability slot |

Query params for slots: `?duration=60` (60, 90, or 120 minutes)

---

## Features

- JWT authentication with protected routes
- Student registration (first name, last name, email, study level, password)
- Teacher hardcoded admin login
- Calendar UI for date selection (only available days are clickable)
- 30-minute increment time slots auto-generated from availability windows
- Double-booking prevention with PostgreSQL `SELECT...FOR UPDATE` locking
- Fake Google Meet link generation (`https://meet.google.com/xxx-xxxx-xxx`)
- Email notifications: booking confirmation, reschedule, cancellation
- Hourly cron job for 1-hour-before session reminder emails
- Teacher can manage weekly availability (add/delete day+time windows)
- Students can modify (reschedule) or cancel bookings
- Teachers can cancel any booking

---

## Gmail App Password Setup (for emails)

1. Enable 2-Factor Authentication on your Google account
2. Go to **Google Account → Security → App Passwords**
3. Create a new App Password for "Mail"
4. Use that 16-character password as `SMTP_PASS` in `.env`
