import nodemailer from "nodemailer";

let transporter;

const getTransporter = () => {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_USER && SMTP_PASS) {
    // Strip any accidental spaces from Google 16-character app password
    const cleanPass = SMTP_PASS.replace(/\s+/g, "");
    const port = Number(SMTP_PORT) || 587;

    transporter = nodemailer.createTransport({
      host: SMTP_HOST || "smtp.gmail.com",
      port: port,
      secure: port === 465, // false for port 587 (uses STARTTLS)
      auth: {
        user: SMTP_USER,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
    });
  } else {
    transporter = null;
  }
  return transporter;
};

export const verifyMailer = async () => {
  if (process.env.RESEND_API_KEY) {
    console.log("Resend HTTP Mailer ready (Port 443 - Bypasses cloud SMTP blocks)");
    return;
  }
  const t = getTransporter();
  if (!t) {
    console.log("SMTP not configured: OTP will be printed in console");
    return;
  }
  try {
    await t.verify();
    console.log("SMTP ready");
  } catch (err) {
    console.error("SMTP error:", err.message);
  }
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Helper to sanitize CLIENT_URL even if comma-separated values exist
const getCleanClientUrl = () => {
  const rawUrls = (process.env.CLIENT_URL || "https://library-management-iota-two.vercel.app")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const selected = rawUrls.find((u) => u.startsWith("https://")) || rawUrls[0] || "https://library-management-iota-two.vercel.app";
  return selected.replace(/\/+$/, "");
};

// Helper for sending via Resend HTTPS API if key is present
const sendViaResend = async ({ to, subject, html, text }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM_NAME
        ? `${process.env.MAIL_FROM_NAME} <onboarding@resend.dev>`
        : "LibraryHub <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Resend error: ${res.statusText}`);
  }

  return true;
};

export const sendOtpEmail = async (to, name, otp) => {
  const subject = "Your LibraryHub password reset code";
  const text = `Hello ${name}, your OTP is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto">
      <h2 style="color:#5b3df5">LibraryHub</h2>
      <p>Hello ${escapeHtml(name)},</p>
      <p>Use this code to reset your password:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f4f0ff;padding:12px;text-align:center;border-radius:8px">${otp}</p>
      <p style="color:#6b6784;font-size:13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    </div>`;

  if (process.env.RESEND_API_KEY) {
    await sendViaResend({ to, subject, html, text });
    return;
  }

  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("Email is not configured");
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
};

export const sendAccountDeletionEmail = async (to, name, userId, rawToken) => {
  const clientUrl = getCleanClientUrl();
  const confirmUrl = `${clientUrl}/delete-account-confirm?token=${rawToken}`;
  const subject = "Action Required: Confirm LibraryHub Account Deletion";

  const textContent = `Hello ${name},

You have requested to permanently delete your LibraryHub account.

Account Details:
- User ID: ${userId}
- Name: ${name}
- Email: ${to}

Important Notice:
Deleting your account is permanent. All your borrowing history, active membership benefits, and transaction records will be permanently erased.

To confirm permanent deletion, open the following link in your browser:
${confirmUrl}

This confirmation link will expire in 15 minutes.
If you did not request this, you can safely ignore this email. Your account remains secure.`;

  const htmlContent = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:auto;padding:24px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937">
      <div style="border-bottom:1px solid #f3f4f6;padding-bottom:14px;margin-bottom:18px">
        <h2 style="margin:0;color:#5c6bc0;font-size:20px">LibraryHub</h2>
        <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280">Account Security & Privacy</p>
      </div>

      <h3 style="color:#dc2626;margin:0 0 10px 0;font-size:17px">Confirm Permanent Account Deletion</h3>
      <p style="font-size:14px;line-height:1.5;margin:0 0 14px 0">
        Hello <strong>${escapeHtml(name)}</strong>,
      </p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 14px 0">
        We received a request to permanently delete your LibraryHub account.
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:18px;font-size:13px">
        <div style="margin-bottom:5px"><strong>Member ID:</strong> <span style="font-family:monospace">${escapeHtml(String(userId))}</span></div>
        <div style="margin-bottom:5px"><strong>Name:</strong> ${escapeHtml(name)}</div>
        <div><strong>Registered Email:</strong> ${escapeHtml(to)}</div>
      </div>

      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 14px;margin-bottom:20px;font-size:13px;color:#991b1b">
        <strong style="display:block;margin-bottom:4px">What happens when your account is deleted?</strong>
        <ul style="margin:0;padding-left:18px;line-height:1.5">
          <li>Your personal details and login credentials will be erased immediately.</li>
          <li>Your membership plan and privileges will be terminated.</li>
          <li>All your borrowing history, requests, and payment transactions will be permanently deleted.</li>
          <li>This action cannot be undone.</li>
        </ul>
      </div>

      <div style="text-align:center;margin:24px 0">
        <a href="${confirmUrl}" style="background:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;display:inline-block">
          Confirm Account Deletion
        </a>
      </div>

      <p style="font-size:12px;color:#6b7280;margin:18px 0 0 0;text-align:center">
        This link will expire in <strong>15 minutes</strong>.<br>
        If you did not request this, please ignore this email or change your password.
      </p>
    </div>
  `;

  // Send via Resend HTTPS API if key exists (Bypasses all cloud SMTP port blocks)
  if (process.env.RESEND_API_KEY) {
    await sendViaResend({
      to,
      subject,
      html: htmlContent,
      text: textContent,
    });
    return;
  }

  // Fallback to Nodemailer SMTP
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("Email service is not configured. Add SMTP or RESEND_API_KEY in Railway.");
    console.log(`[DEV] Deletion link: ${confirmUrl}`);
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: textContent,
    html: htmlContent,
  });
};