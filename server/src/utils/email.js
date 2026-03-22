import { getMailer } from "../config/mailer.js";

export async function sendVerificationEmail({ email, name, verificationLink }) {
  const mailer = getMailer();

  await mailer.sendMail({
    from: process.env.SMTP_EMAIL,
    to: email,
    subject: "Verify your AstroAI account",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Welcome to AstroAI</h2>
        <p>Hello ${name},</p>
        <p>Click the button below to verify your email and start using your account.</p>
        <p>
          <a href="${verificationLink}" style="display:inline-block;padding:12px 18px;background:#d99200;color:#fffaf0;border-radius:10px;text-decoration:none;font-weight:700">
            Verify Email
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p>${verificationLink}</p>
      </div>
    `
  });
}
