# Email Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Resend-powered email confirmation to student registration, with an "Allow + banner" UX — students use the app immediately but see a yellow banner until they confirm.

**Architecture:** Token stored in DB (`confirmation_token` + `email_confirmed` columns on `students`). Register generates token + fires email (best-effort). New `GET /api/auth/confirm/:token` route marks confirmed and returns a fresh JWT. Frontend shows banner in dashboard; `/confirm/:token` page auto-logs in and redirects.

**Tech Stack:** Node.js/Express, `resend` npm package, React + React Router, PostgreSQL (Neon via Railway), Tailwind CSS.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/src/routes/auth.js` | Register: generate token, fire email; new confirm route; login: add `email_confirmed` to JWT |
| Create | `backend/src/services/resendService.js` | Send confirmation email via Resend API |
| Modify | `frontend/src/App.jsx` | Add public `/confirm/:token` route |
| Create | `frontend/src/pages/ConfirmEmail.jsx` | Call confirm API, save JWT, redirect to dashboard |
| Modify | `frontend/src/pages/StudentDashboard.jsx` | Yellow banner when `!user.email_confirmed` |

---

## Task 1: Database Migration

**Files:**
- No file — run SQL directly against your Railway/Neon database

- [ ] **Step 1: Add columns to students table**

Connect to your database (Railway dashboard → your Postgres service → Query tab, or `psql`) and run:

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT;
```

- [ ] **Step 2: Verify columns exist**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('email_confirmed', 'confirmation_token');
```

Expected: 2 rows returned — `email_confirmed` (boolean, default false) and `confirmation_token` (text).

- [ ] **Step 3: Commit migration note**

```bash
git commit --allow-empty -m "db: add email_confirmed and confirmation_token to students"
```

---

## Task 2: Resend Service

**Files:**
- Create: `backend/src/services/resendService.js`

- [ ] **Step 1: Install resend package**

```bash
cd backend && npm install resend
```

Expected output ends with: `added 1 package`

- [ ] **Step 2: Create the service file**

Create `backend/src/services/resendService.js`:

```js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
const FROM = 'noreply@ibooknow.site';

async function sendConfirmationEmail(toEmail, firstName, token) {
  const confirmUrl = `${FRONTEND_URL}/confirm/${token}`;

  await resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Confirmez votre adresse e-mail — iBookNow',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#06b6d4,#3b82f6);padding:32px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">📚</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Bienvenue sur iBookNow !</h1>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;font-size:16px;margin:0 0 16px">Bonjour ${firstName},</p>
      <p style="color:#6b7280;font-size:15px;margin:0 0 28px;line-height:1.6">
        Merci de vous être inscrit(e). Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.
      </p>
      <a href="${confirmUrl}"
         style="display:block;text-align:center;padding:14px 28px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px">
        Confirmer mon adresse e-mail
      </a>
      <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center">
        Ce lien est à usage unique. Si vous n'avez pas créé de compte, ignorez cet e-mail.
      </p>
    </div>
  </div>
</body>
</html>`,
  });
}

module.exports = { sendConfirmationEmail };
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/resendService.js backend/package.json backend/package-lock.json
git commit -m "feat: add Resend confirmation email service"
```

---

## Task 3: Update Register Route

**Files:**
- Modify: `backend/src/routes/auth.js`

- [ ] **Step 1: Add crypto import and resendService import at the top of auth.js**

After line 1 (`const express = require('express');`), add:

```js
const crypto = require('crypto');
const { sendConfirmationEmail } = require('../services/resendService');
```

- [ ] **Step 2: Replace the register route body**

Replace the entire `router.post('/register', ...)` handler with:

```js
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
    const confirmation_token = crypto.randomBytes(32).toString('hex');

    const { rows } = await pool.query(
      `INSERT INTO students (first_name, last_name, email, study_level, password_hash, confirmation_token, email_confirmed)
       VALUES ($1,$2,$3,$4,$5,$6,false)
       RETURNING id, first_name, last_name, email, study_level, email_confirmed`,
      [first_name, last_name, email, study_level, password_hash, confirmation_token],
    );

    const student = rows[0];
    const token = signToken({
      id: student.id, email: student.email, role: 'student',
      first_name: student.first_name, last_name: student.last_name,
      study_level: student.study_level, email_confirmed: false,
    });

    // Fire-and-forget — don't block registration if email fails
    sendConfirmationEmail(student.email, student.first_name, confirmation_token)
      .catch((err) => console.error('Confirmation email error:', err.message));

    res.status(201).json({ token, user: { ...student, role: 'student' } });
  } catch (err) {
    console.error('Register error:', err.message, err.code);
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});
```

- [ ] **Step 3: Verify manually — register a new student**

```bash
curl -s -X POST https://booking-app-production-ed39.up.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Test","last_name":"User","email":"test123@example.com","study_level":"Terminale","password":"test1234"}' \
  | jq '{token_present: (.token != null), email_confirmed: .user.email_confirmed}'
```

Expected:
```json
{ "token_present": true, "email_confirmed": false }
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.js
git commit -m "feat: generate confirmation token and send email on register"
```

---

## Task 4: Add Confirm Route

**Files:**
- Modify: `backend/src/routes/auth.js`

- [ ] **Step 1: Add the confirm route after the login route (before `module.exports`)**

```js
// GET /api/auth/confirm/:token
router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, first_name, last_name, email, study_level FROM students WHERE confirmation_token = $1 AND email_confirmed = false',
      [token],
    );

    if (!rows.length)
      return res.status(400).json({ error: 'Invalid or already used link' });

    const student = rows[0];

    await pool.query(
      'UPDATE students SET email_confirmed = true, confirmation_token = NULL WHERE id = $1',
      [student.id],
    );

    const freshToken = signToken({
      id: student.id, email: student.email, role: 'student',
      first_name: student.first_name, last_name: student.last_name,
      study_level: student.study_level, email_confirmed: true,
    });

    res.json({ token: freshToken, user: { ...student, role: 'student', email_confirmed: true } });
  } catch (err) {
    console.error('Confirm error:', err.message);
    res.status(500).json({ error: 'Confirmation failed' });
  }
});
```

- [ ] **Step 2: Verify manually — test with a real token**

First get a token from the DB:
```sql
SELECT confirmation_token FROM students WHERE email = 'test123@example.com';
```

Then call the confirm route:
```bash
curl -s https://booking-app-production-ed39.up.railway.app/api/auth/confirm/<TOKEN> \
  | jq '{token_present: (.token != null), email_confirmed: .user.email_confirmed}'
```

Expected:
```json
{ "token_present": true, "email_confirmed": true }
```

Calling it a second time with the same token should return:
```json
{ "error": "Invalid or already used link" }
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/auth.js
git commit -m "feat: add GET /api/auth/confirm/:token route"
```

---

## Task 5: Add email_confirmed to Login JWT

**Files:**
- Modify: `backend/src/routes/auth.js`

- [ ] **Step 1: Update the student login block to include email_confirmed in the JWT**

In the student login section, find:
```js
const token = signToken({ id: safe.id, email: safe.email, role: 'student',
  first_name: safe.first_name, last_name: safe.last_name,
  study_level: safe.study_level });
res.json({ token, user: { ...safe, role: 'student' } });
```

Replace with:
```js
const token = signToken({ id: safe.id, email: safe.email, role: 'student',
  first_name: safe.first_name, last_name: safe.last_name,
  study_level: safe.study_level, email_confirmed: safe.email_confirmed ?? false });
res.json({ token, user: { ...safe, role: 'student' } });
```

- [ ] **Step 2: Verify login returns email_confirmed**

```bash
curl -s -X POST https://booking-app-production-ed39.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sara.dupont@cours.fr","password":"demo1234"}' \
  | jq '.user.email_confirmed'
```

Expected: `true` (demo account is pre-seeded as confirmed) or `false` for new accounts.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/auth.js
git commit -m "feat: include email_confirmed in login JWT payload"
```

---

## Task 6: Create ConfirmEmail Page

**Files:**
- Create: `frontend/src/pages/ConfirmEmail.jsx`

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/ConfirmEmail.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ConfirmEmail() {
  const { token }    = useParams();
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'error'

  useEffect(() => {
    api.get(`/auth/confirm/${token}`)
      .then(({ data }) => {
        login(data.token, data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-400 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Confirmation en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
      <div className="bg-[#111827] rounded-3xl p-8 border border-white/10 max-w-md w-full text-center">
        <div className="text-4xl mb-4">❌</div>
        <h1 className="text-xl font-bold text-white mb-2">Lien invalide</h1>
        <p className="text-slate-400 text-sm mb-6">Ce lien est invalide ou a déjà été utilisé.</p>
        <a href="/" className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold">
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ConfirmEmail.jsx
git commit -m "feat: add ConfirmEmail page"
```

---

## Task 7: Register Route in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add the import for ConfirmEmail**

After line 11 (`import InvoiceHistory from './pages/InvoiceHistory';`), add:

```jsx
import ConfirmEmail from './pages/ConfirmEmail';
```

- [ ] **Step 2: Add the route inside `<Routes>` in AppRoutes**

After the `/register` route (line 39), add:

```jsx
<Route path="/confirm/:token" element={<ConfirmEmail />} />
```

This route is intentionally public (no `ProtectedRoute`) — the page itself handles the auth.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: add /confirm/:token route"
```

---

## Task 8: Unconfirmed Email Banner in StudentDashboard

**Files:**
- Modify: `frontend/src/pages/StudentDashboard.jsx`

- [ ] **Step 1: Add the banner after the opening wrapper div (line 377)**

Find this line in `StudentDashboard.jsx`:

```jsx
      <div className="flex-1 md:ml-16 flex flex-col overflow-hidden">
```

Add the banner immediately after it:

```jsx
      <div className="flex-1 md:ml-16 flex flex-col overflow-hidden">
        {!user.email_confirmed && (
          <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-5 py-3 flex items-center gap-2 shrink-0">
            <span className="text-yellow-400 text-sm">⚠</span>
            <p className="text-yellow-300 text-sm">
              Vérifiez votre boîte mail pour confirmer votre adresse e-mail.
            </p>
          </div>
        )}
```

- [ ] **Step 2: Update the demo student seed so it's pre-confirmed**

In `backend/src/index.js`, find the demo student INSERT in `seedDemo()`:

```js
await pool.query(
  `INSERT INTO students (first_name, last_name, email, study_level, password_hash)
   VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING`,
  ['Sara', 'Dupont', 'sara.dupont@cours.fr', 'Terminale', hash],
);
```

Replace with:

```js
await pool.query(
  `INSERT INTO students (first_name, last_name, email, study_level, password_hash, email_confirmed)
   VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT (email) DO NOTHING`,
  ['Sara', 'Dupont', 'sara.dupont@cours.fr', 'Terminale', hash],
);
```

Also add an UPDATE to mark existing demo student as confirmed (in case she already exists):

```js
await pool.query(
  `UPDATE students SET email_confirmed = true WHERE email = 'sara.dupont@cours.fr'`,
);
```

Add that line right after the INSERT.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/StudentDashboard.jsx backend/src/index.js
git commit -m "feat: show email confirmation banner and fix demo seed"
```

---

## Task 9: Set RESEND_API_KEY on Railway

**Files:**
- No code — Railway environment variable

- [ ] **Step 1: Add env var on Railway**

Go to Railway → your backend service → **Variables** → add:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
```

(Copy your API key from resend.com → API Keys)

Railway will auto-redeploy. No code change needed.

- [ ] **Step 2: End-to-end test**

1. Go to `https://ibooknow.site`
2. Register a new account with a real email you can check
3. You should be logged in immediately and see the yellow banner
4. Check your inbox — confirmation email should arrive within ~30 seconds
5. Click "Confirmer mon adresse e-mail"
6. You should land on `/dashboard` — banner is gone

---

## Task 10: Deploy

- [ ] **Step 1: Push backend to trigger Railway deploy**

```bash
git push origin main
```

- [ ] **Step 2: Deploy frontend to Vercel**

```bash
cd frontend && npx vercel --prod
```

Or push to main if Vercel auto-deploys on push.

- [ ] **Step 3: Smoke test on live site**

Repeat Task 9 Step 2 on `https://ibooknow.site` with a real email.
