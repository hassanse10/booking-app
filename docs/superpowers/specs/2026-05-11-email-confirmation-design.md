# Email Confirmation — Design Spec
**Date:** 2026-05-11  
**Status:** Approved  

---

## Overview

Add email confirmation to the student registration flow using Resend. Students can use the app immediately after registering (no gate), but see a banner until they confirm. Clicking the confirmation link auto-logs them in and lands them on the dashboard.

---

## Architecture

### Database
Add two columns to the `students` table:
```sql
ALTER TABLE students ADD COLUMN email_confirmed BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN confirmation_token TEXT;
```

### Backend

**`POST /api/auth/register`** (modified)
- Behavior unchanged: create student, return JWT + user object immediately
- Additionally: generate a 32-byte random hex token, store in `confirmation_token`, send confirmation email via Resend
- JWT payload and user object include `email_confirmed: false`
- If Resend fails, log the error but do NOT fail registration (email is best-effort)

**`GET /api/auth/confirm/:token`** (new)
- Find student by `confirmation_token`
- If not found or already confirmed → return 400
- Set `email_confirmed = true`, clear `confirmation_token`
- Return a fresh JWT + user object (same shape as login response)

**`POST /api/auth/login`** (unchanged)
- Unconfirmed students can log in normally
- `email_confirmed` included in JWT payload

### Email (Resend)
- Install `resend` npm package
- Add `RESEND_API_KEY` to Railway env vars
- Confirmation link = `${FRONTEND_URL.split(',')[0]}/confirm/${token}` (use first entry only, since FRONTEND_URL is comma-separated)
- Simple HTML email: heading, one-sentence explanation, single CTA button "Confirmer mon adresse e-mail"
- Sender: `noreply@ibooknow.site` — requires `ibooknow.site` to be verified as a sending domain in the Resend dashboard (DNS records)
- Keep existing Nodemailer service untouched (reminder emails still use it)

### Frontend

**`/confirm/:token` (new page)**
- On mount: call `GET /api/auth/confirm/:token`
- On success: call `login(token, user)` from AuthContext, redirect to `/dashboard`
- On error: show "Lien invalide ou déjà utilisé" message with link back to home

**`StudentDashboard` (modified)**
- If `!user.email_confirmed`: show yellow banner at top
  - Text: "Vérifiez votre boîte mail pour confirmer votre adresse e-mail."
  - Dismissible? No — stays until confirmed
  - Banner disappears automatically when `user.email_confirmed` becomes true (i.e. after clicking confirmation link and getting fresh JWT)

**`AuthContext` (unchanged)**
- `email_confirmed` already flows through JWT decode and localStorage

---

## Data Flow

```
Register → account created → JWT returned (email_confirmed: false)
        → Resend sends email in background (fire-and-forget)

Student clicks link in email
→ GET /confirm/:token
→ Backend marks confirmed, returns fresh JWT (email_confirmed: true)
→ Frontend: login() saves new JWT, redirect to /dashboard
→ Banner gone
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Resend API key missing | Log warning, skip email, registration still succeeds |
| Resend send failure | Log error, skip email, registration still succeeds |
| Invalid/expired token | 400 response, frontend shows error message |
| Token already used | 400 response (token cleared after first use) |
| Student registers twice with same email | Blocked at DB level (existing behaviour) |

---

## Environment Variables (Railway)
| Variable | Value |
|---|---|
| `RESEND_API_KEY` | From resend.com dashboard |
| `FRONTEND_URL` | Already set to `https://ibooknow.site,https://www.ibooknow.site` — confirmation link uses first value |

---

## Out of Scope
- Resend confirmation button in banner
- Token expiry (one-time use is sufficient)
- Google OAuth
