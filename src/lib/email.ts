import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendRequestNotificationEmail(input: {
  to: string;
  subject: string;
  message: string;
}) {
  if (!resend) {
    return { ok: false, reason: "RESEND_API_KEY is not configured." };
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "LANHS DRMS <no-reply@example.com>",
    to: input.to,
    subject: input.subject,
    text: input.message,
  });

  return { ok: true };
}

