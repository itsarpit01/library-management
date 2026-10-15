import nodemailer from "nodemailer";

let transporter; // pehli baar use hone par banega

const getTransporter = () => {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const port = Number(SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  } else {
    transporter = null;
  }
  return transporter;
};

// server start par ek baar connection check (server.js se call hoga)
export const verifyMailer = async () => {
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

export const sendOtpEmail = async (to, name, otp) => {
  const t = getTransporter();

  // SMTP set nahi hai to dev mein OTP terminal mein dikha do
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("Email is not configured");
    console.log(`[DEV] OTP for ${to}: ${otp}`);
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Your LibraryHub password reset code",
    text: `Hello ${name}, your OTP is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto">
        <h2 style="color:#5b3df5">LibraryHub</h2>
        <p>Hello ${escapeHtml(name)},</p>
        <p>Use this code to reset your password:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f4f0ff;padding:12px;text-align:center;border-radius:8px">${otp}</p>
        <p style="color:#6b6784;font-size:13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      </div>`,
  });
};