# SMTP Configuration Guide for Email Reminders

## Current Status
✅ Email code is ready in `backend/src/services/emailService.js`
⏳ Just need to add SMTP credentials to Railway

## Required Environment Variables
```
SMTP_HOST = (email server address)
SMTP_PORT = (usually 587 or 465)
SMTP_USER = (email address)
SMTP_PASS = (password or app password)
TEACHER_EMAIL = (optional, for CC on emails)
TEACHER_NAME = (optional, defaults to 'Ahmed Ben Ali')
```

---

## OPTION 1: Gmail (Recommended if you have Gmail)

**Easiest setup, free, reliable**

### Step 1: Create Gmail App Password
1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Select: **App: Mail** → **Device: Windows Computer**
3. Google generates a 16-character password (copy it)
4. You'll see: `xxxx xxxx xxxx xxxx`

### Step 2: Add to Railway
In your Railway dashboard:
1. Go to **Variables** tab
2. Add these variables:
   ```
   SMTP_HOST = smtp.gmail.com
   SMTP_PORT = 587
   SMTP_USER = your-email@gmail.com
   SMTP_PASS = xxxx xxxx xxxx xxxx (the 16-char password, remove spaces)
   TEACHER_NAME = Ahmed Ben Ali (or your name)
   TEACHER_EMAIL = your-email@gmail.com
   ```
3. Click **Deploy** to redeploy backend with new vars

### Step 3: Test
- Deploy backend
- Wait 2-3 minutes
- Make a booking and check email for confirmation

---

## OPTION 2: Brevo (Best for European users)

**Free tier: 300 emails/day, no credit card needed**

### Step 1: Create Brevo Account
1. Go to [brevo.com/pricing](https://brevo.com/pricing) → Free plan
2. Sign up with your email
3. Verify email
4. Go to **Settings** → **SMTP & API**
5. Click **SMTP Tab** → Copy credentials:
   - SMTP Host
   - SMTP Port: 587
   - SMTP User (your email)
   - SMTP Pass (generate here or get existing)

### Step 2: Add to Railway
In your Railway dashboard:
1. Go to **Variables** tab
2. Add:
   ```
   SMTP_HOST = smtp-relay.brevo.com
   SMTP_PORT = 587
   SMTP_USER = (your Brevo email)
   SMTP_PASS = (your Brevo API key / SMTP pass)
   TEACHER_NAME = Ahmed Ben Ali
   TEACHER_EMAIL = your-email@your-domain.com
   ```
3. Click **Deploy**

### Step 3: Test
- Deploy backend (2-3 min)
- Make a booking
- Check email

---

## OPTION 3: SendGrid

**Free tier: 100 emails/day with credit card**

### Step 1: Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com) → Free tier
2. Sign up (requires credit card, but won't charge)
3. Go to **Settings** → **API Keys**
4. Create new API key
5. Go to **Sender Authentication** → Add sender

### Step 2: Add to Railway
```
SMTP_HOST = smtp.sendgrid.net
SMTP_PORT = 587
SMTP_USER = apikey
SMTP_PASS = SG.your-api-key-here
TEACHER_NAME = Ahmed Ben Ali
```

---

## Step-by-Step: Adding Variables to Railway

### Via Railway Dashboard (Easiest)
1. Go to [railway.app](https://railway.app)
2. Select your **booking-app** project
3. Click on the **backend** service
4. Go to **Variables** tab
5. Click **Raw Editor** (optional, shows all at once)
6. Add each variable:
   - Key: `SMTP_HOST`
   - Value: `smtp.gmail.com` (or your provider)
   - Click **Save**
7. Repeat for SMTP_PORT, SMTP_USER, SMTP_PASS, etc.
8. Click **Deploy** button at top

### Via Railway CLI (If installed)
```bash
cd backend
railway variables set SMTP_HOST=smtp.gmail.com
railway variables set SMTP_PORT=587
railway variables set SMTP_USER=your-email@gmail.com
railway variables set SMTP_PASS=xxxx xxxx xxxx xxxx
railway up
```

---

## Verify Setup

### Check Variables Are Set
1. Go to Railway dashboard
2. Service: backend → Variables tab
3. Confirm you see all 4 SMTP variables

### Test Email Sending
1. Backend deploys (wait 2-3 min)
2. Make a test booking in your app
3. Check your inbox (and spam folder)
4. You should see confirmation email

### Monitor Email Errors
Check Railway logs:
1. Service: backend → Logs tab
2. Look for messages like:
   - ✅ `Email send error: none` (success)
   - ❌ `Email send error: Invalid login` (wrong password)
   - ❌ `Email send error: SSL error` (wrong port)

---

## Enable Automated Cron Jobs

Once SMTP is working, these cron jobs activate:

1. **24h Booking Reminders** (daily at 6pm)
   - Sends email to students: "Your session is tomorrow at [time]"
   - Logged to `notifications` table

2. **No-Show Detection** (every 15 min)
   - Checks if student/teacher joined Jitsi
   - Alerts teacher if no-show

3. **Invoice Auto-Send** (Friday 7pm)
   - Auto-generates invoices for the week
   - Emails PDF to student

4. **Waitlist Auto-Notify** (hourly)
   - When slots open, emails waitlisted students
   - "Your requested time is now available!"

---

## Troubleshooting

### "Email send error: Invalid login"
- **Cause**: Wrong password or SMTP_USER
- **Fix**: Double-check credentials, regenerate if needed
- **Gmail**: Use 16-char App Password, not your actual password
- **Brevo**: Use the SMTP-specific password, not API key

### "Email send error: SSL error"
- **Cause**: Wrong SMTP_PORT
- **Fix**: Use 587 (TLS), not 465 (SSL) for Gmail/Brevo

### "Email send error: Connection timeout"
- **Cause**: Wrong SMTP_HOST or firewall blocking
- **Fix**: Verify SMTP_HOST matches your provider
- **Gmail**: `smtp.gmail.com`
- **Brevo**: `smtp-relay.brevo.com`
- **SendGrid**: `smtp.sendgrid.net`

### Emails going to spam
- **Cause**: SPF/DKIM records not configured
- **Fix**: Optional, but add these DNS records for your domain:
  - Gmail: Follow [this guide](https://support.google.com/a/answer/33786)
  - Brevo: Settings → Domain validation
  - SendGrid: Settings → Sender Authentication

### Still not working?
1. Check Railway backend logs for errors
2. Verify all 4 SMTP variables are set (not empty)
3. Test with `curl`:
   ```bash
   curl -X POST http://localhost:5000/api/test-email \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   ```

---

## Recommended Choice

**For your setup (French booking app):**
- 🥇 **Brevo** - Free, 300 emails/day, French company, easiest
- 🥈 **Gmail App Password** - If you already have Gmail
- 🥉 **SendGrid** - If you need higher volume later

**Recommended:** Start with **Gmail App Password** (5 min setup) or **Brevo** (10 min signup).

---

## What Happens After Setup

✅ Backend redeploys with SMTP credentials
✅ Cron jobs activate automatically
✅ Students get 24h reminder emails before sessions
✅ Teacher notified of no-shows
✅ Invoices auto-sent to students
✅ Waitlist notifications sent automatically

**Timeline:** 30 minutes to full email automation working

---

Last Updated: 2026-05-01
