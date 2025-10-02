const nodemailer = require("nodemailer");

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

  // Build text body
  const fields = [
    "name","email","phone","postcode","property","paint_supply",
    "room_size_mode","rooms_count","include_kitchens","include_bathrooms",
    "est_area","est_height","details","start_when","message"
  ];
  const lines = [];
  for (const k of fields) if (data[k] != null && data[k] !== "") lines.push(`${k}: ${data[k]}`);
  const text = lines.join("\n");

  // Prepare attachments + inline <img> with CIDs
  const inlineImgs = [];
  const attachments = [];

  const maxFiles = 8;
  const maxEach = 2 * 1024 * 1024;        // 2MB per file (keep request small)
  const maxTotal = 8 * 1024 * 1024;       // 8MB total JSON payload budget
  let total = 0;

  const items = Array.isArray(data.attachments) ? data.attachments.slice(0, maxFiles) : [];
  items.forEach((a, i) => {
    const b64 = (a.base64 || "");
    const size = Math.ceil(b64.length * 3/4); // approximate bytes for base64
    if (!b64 || size > maxEach || total + size > maxTotal) return;  // skip oversize
    total += size;

    const cid = `photo${i}@inline`; // unique content-id
    attachments.push({
      filename: a.filename || `photo${i}.jpg`,
      content: Buffer.from(b64, "base64"),
      contentType: a.contentType || "image/jpeg",
      cid // this makes it show inline when referenced in HTML
    });
    inlineImgs.push(`<img src="cid:${cid}" style="max-width:240px; height:auto; margin:6px; border-radius:8px; border:1px solid #eee">`);
  });

  const html =
    `<h2>New painting enquiry</h2>
     <pre style="white-space:pre-wrap; font-family:ui-monospace, Menlo, Consolas;">${text}</pre>
     ${inlineImgs.length ? `<p><b>Photos:</b></p><div>${inlineImgs.join("")}</div>` : ""}`;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.TO_EMAIL,
      subject: "New painting enquiry",
      text,
      html,
      attachments
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Email failed" });
  }
});
