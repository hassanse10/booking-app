const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
const FROM = 'noreply@ibooknow.site';

async function sendConfirmationEmail(toEmail, firstName, token) {
  const name = firstName || 'là';
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
      <p style="color:#374151;font-size:16px;margin:0 0 16px">Bonjour ${name},</p>
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
