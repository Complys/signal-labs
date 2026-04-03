import sgMail from "@sendgrid/mail";

const FROM =
  process.env.ORDERS_FROM_EMAIL ||
  "Signal Laboratories <info@signallaboratories.co.uk>";

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY not set — email not sent:", subject);
    return;
  }

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    to,
    from: FROM,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}
