// notify.js - emails the team when someone joins the waitlist (Gmail SMTP with an app password).
const nodemailer = require("nodemailer");

function transportFromEnv() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null; // not configured: sign-ups are still saved, just no email
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

// Never throws: a failed email must not lose or block a sign-up. Waits (briefly) because serverless
// functions are frozen as soon as the response is sent.
async function notifySignup(d, transport = transportFromEnv()) {
  if (!transport) return { sent: false, reason: "not configured" };
  const lines = [`Email: ${d.email}`, `Company: ${d.company || "-"}`, `Role: ${d.role || "-"}`, `Monthly AI spend: ${d.spend_range || "-"}`, `Providers: ${d.providers || "-"}`, `Notes: ${d.notes || "-"}`];
  try {
    await Promise.race([
      transport.sendMail({
        from: `Kivora site <${process.env.GMAIL_USER || "no-reply@localhost"}>`,
        to: process.env.NOTIFY_TO || process.env.GMAIL_USER,
        subject: `New Kivora waitlist sign-up: ${d.email}`,
        text: lines.join("\n"), // plain text only, so nothing a visitor types can be rendered as HTML
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("email timed out")), 7000)),
    ]);
    return { sent: true };
  } catch (err) {
    console.error("signup email failed:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { notifySignup };
