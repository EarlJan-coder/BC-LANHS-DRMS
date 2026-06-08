import { Resend } from "resend";
import { APP_NAME, SCHOOL_NAME } from "@/lib/constants";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "LANHS DRMS <no-reply@example.com>";

export async function sendRequestNotificationEmail(input: {
  to: string;
  subject: string;
  message: string;
}) {
  if (!resend) {
    return { ok: false, reason: "RESEND_API_KEY is not configured." };
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: input.to,
      subject: input.subject,
      text: input.message,
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Unable to send email." };
  }

  return { ok: true };
}

export async function sendWorkflowEmail(input: {
  to?: string | null;
  studentName: string;
  trackingNumber?: string;
  documentType?: string;
  status?: string;
  subject: string;
  instruction: string;
}) {
  if (!input.to) {
    return { ok: false, reason: "Recipient email is missing." };
  }

  const lines = [
    `Good day ${input.studentName},`,
    "",
    input.trackingNumber ? `Tracking number: ${input.trackingNumber}` : null,
    input.documentType ? `Document type: ${input.documentType}` : null,
    input.status ? `Current status: ${input.status.replaceAll("_", " ")}` : null,
    "",
    input.instruction,
    "",
    `Thank you,`,
    `${SCHOOL_NAME} Registrar`,
    "",
    `${APP_NAME} - Student Records and Document Request Management System`,
  ].filter(Boolean);

  return sendRequestNotificationEmail({
    to: input.to,
    subject: input.subject,
    message: lines.join("\n"),
  });
}
