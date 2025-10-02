// Serverless mailer for Vercel (Zoho/Gmail/etc.)
const nodemailer = require("nodemailer");

// CORS
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

  // Build a readable email body
  const fields = [
    "name","email","phone","postcode","property","paint_supply",
    "room_size_mode","rooms_count","include_kitchens","include_bathrooms",
    "est_area","est_height","details","start_when","message"
  ];
  const lines = [];
  for (const k of fields) if (data[k] != null && data[k] !== "") lines.push(`${k}: ${data[k]}`);
  const text = lines.join("\n");

  // Attachments (from base64 sent by the client)
  let attachments = [];
  if (Array.isArray(data.attachments)) {
    attachments = data.attachments
      .slice(0, 8) // safety cap
      .map(a => ({
        filename: a.filename || "photo",
        content: Buffer.from(a.base64 || "", "base64"),
        contentType: a.contentType || "application/octet-stream"
      }))
      .filter(a => a.content.length > 0);
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true", // 465 => true
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.TO_EMAIL,
      subject: "New painting enquiry",
      text,
      html: `<h2>New painting enquiry</h2><pre style="white-space:pre-wrap">${text}</pre>`,
      attachments
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Email failed" });
  }
});
