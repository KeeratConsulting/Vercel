// Serverless mailer for Vercel (Zoho/Gmail/etc.)
const nodemailer = require("nodemailer");

// CORS (so any page on your site can POST here)
const allowCors = (handler) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  return handler(req, res);
};

module.exports = allowCors(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const data = req.body || {};

  // Build a nice summary of submitted fields
  const orderedKeys = [
    "name","email","phone","postcode","address",
    "service","budget","timeline","message",
    "photo_url_1","photo_url_2","photo_url_3","photo_url_4","photo_url_5",
    "source"
  ];
  const lines = [];
  for (const k of orderedKeys) if (data[k]) lines.push(`${k}: ${data[k]}`);
  // include any extra fields just in case
  for (const [k,v] of Object.entries(data)) if (!orderedKeys.includes(k)) lines.push(`${k}: ${v}`);
  const text = lines.join("\n");

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true", // 465 => true, 587 => false
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.TO_EMAIL,
      subject: "New enquiry from your website",
      text,
      html: `<h2>New website enquiry</h2><pre style="white-space:pre-wrap">${text}</pre>`
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Email failed" });
  }
});
