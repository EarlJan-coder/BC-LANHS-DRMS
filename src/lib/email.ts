import { Resend } from "resend";
import { APP_NAME, SCHOOL_NAME } from "@/lib/constants";
import { renderWorkflowEmailHtml } from "@/lib/email-template";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "LANHS DRMS <no-reply@lanhsdrms.online>";

async function sendRequestNotificationEmail(input: {
  to: string;
  subject: string;
  message: string;
  html?: string;
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
      html: input.html,
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
    html: renderWorkflowEmailHtml({
      studentName: input.studentName,
      trackingNumber: input.trackingNumber,
      documentType: input.documentType,
      status: input.status,
      instruction: input.instruction,
    }),
  });
}

export async function sendRegistrationDecisionEmail(input: {
  to: string;
  studentName: string;
  decision: "approved" | "declined";
  note: string;
}) {
  const content = buildRegistrationDecisionEmailContent(input);
  return sendRequestNotificationEmail({ to: input.to, ...content });
}

export function buildRegistrationDecisionEmailContent(input: {
  studentName: string;
  decision: "approved" | "declined";
  note: string;
}) {
  const outcome = input.decision === "approved" ? "approved" : "declined";
  const instructions =
    input.decision === "approved"
      ? "You may now sign in to LANHS DRMS using the email or LRN and password you registered with."
      : "Please contact the registrar if you have questions about this decision.";

  const message = [
    `Good day ${input.studentName},`,
    "",
    `Your student registration has been ${outcome}.`,
    "",
    `Registrar note: ${input.note.trim()}`,
    "",
    instructions,
    "",
    `${SCHOOL_NAME} Registrar`,
    `${APP_NAME} - Student Records and Document Request Management System`,
  ].join("\n");

  return {
    subject: `LANHS DRMS registration ${outcome}`,
    message,
  };
}
