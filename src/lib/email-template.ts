import { APP_NAME, SCHOOL_ADDRESS, SCHOOL_NAME } from "@/lib/constants";

type StatusStyle = { label: string; bg: string; fg: string };

const STATUS_STYLES: Record<string, StatusStyle> = {
  pending: { label: "Pending", bg: "#fffbeb", fg: "#b45309" },
  under_review: { label: "Under Review", bg: "#e0f2fe", fg: "#0369a1" },
  approved: { label: "Approved", bg: "#d1fae5", fg: "#047857" },
  rejected: { label: "Rejected", bg: "#fee2e2", fg: "#b91c1c" },
  processing: { label: "Processing", bg: "#f3e8ff", fg: "#6d28d9" },
  ready_for_pickup: { label: "Ready for Pickup", bg: "#ccfbf1", fg: "#0f766e" },
  claimed: { label: "Claimed", bg: "#f1f5f9", fg: "#334155" },
  cancelled: { label: "Cancelled", bg: "#e4e4e7", fg: "#27272a" },
  certificate_generated: { label: "Certificate Generated", bg: "#fee2e2", fg: "#7f1d1d" },
};

const NEUTRAL_BG = "#f1f5f9";
const NEUTRAL_FG = "#334155";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface WorkflowEmailTemplateInput {
  studentName: string;
  trackingNumber?: string;
  documentType?: string;
  status?: string;
  instruction: string;
}

function statusStyle(status: string): StatusStyle {
  const known = STATUS_STYLES[status];
  if (known) {
    return known;
  }
  return { label: status.replaceAll("_", " "), bg: NEUTRAL_BG, fg: NEUTRAL_FG };
}

function renderDetailsTable(rows: Array<{ label: string; valueHtml: string }>): string {
  if (rows.length === 0) {
    return "";
  }

  const rowHtml = rows
    .map((row, index) => {
      const divider = index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : "";
      return `<tr>
            <td valign="top" width="150" style="width:150px;padding:10px 16px;font-size:13px;color:#6b7280;${divider}">${row.label}</td>
            <td valign="top" style="padding:10px 16px;font-size:14px;color:#111827;font-weight:600;${divider}">${row.valueHtml}</td>
          </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border:1px solid #e5e7eb;border-radius:6px;">
          ${rowHtml}
        </table>`;
}

export function renderWorkflowEmailHtml(input: WorkflowEmailTemplateInput): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  const logoSrc = appUrl ? `${appUrl}/lanhs-logo.png` : null;

  const rows: Array<{ label: string; valueHtml: string }> = [];
  if (input.trackingNumber) {
    rows.push({ label: "Tracking number", valueHtml: escapeHtml(input.trackingNumber) });
  }
  if (input.documentType) {
    rows.push({ label: "Document type", valueHtml: escapeHtml(input.documentType) });
  }
  if (input.status) {
    const style = statusStyle(input.status);
    rows.push({
      label: "Current status",
      valueHtml: `<span style="display:inline-block;padding:3px 10px;border-radius:9999px;background:${style.bg};color:${style.fg};font-size:12px;font-weight:700;">${escapeHtml(style.label)}</span>`,
    });
  }

  const logoHtml = logoSrc
    ? `<td valign="middle" width="56" style="width:56px;">
                <img src="${escapeHtml(logoSrc)}" width="56" height="56" alt="LANHS logo" style="display:block;border:0;border-radius:10px;" />
              </td>`
    : "";

  const header = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${logoHtml}
              <td valign="middle" style="padding-left:${logoSrc ? "14px" : "0"};">
                <p style="margin:0;font-size:19px;font-weight:700;color:#111827;">${escapeHtml(APP_NAME)}</p>
                <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">${escapeHtml(SCHOOL_NAME)}</p>
              </td>
            </tr>
          </table>`;

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-top:1px solid #e5e7eb;">
            <tr>
              <td align="center" style="padding:16px 24px;">
                <p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">${escapeHtml(SCHOOL_ADDRESS)}</p>
                ${
                  appUrl
                    ? `<p style="margin:0 0 4px 0;font-size:12px;"><a href="${escapeHtml(appUrl)}" style="color:#b91c1c;text-decoration:none;">${escapeHtml(appUrl.replace(/^https?:\/\//, ""))}</a></p>`
                    : ""
                }
                <p style="margin:0;font-size:12px;color:#6b7280;">This is an automated notification from ${escapeHtml(APP_NAME)}. Please do not reply to this email.</p>
              </td>
            </tr>
          </table>`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
            <tr>
              <td style="padding:22px 24px 18px 24px;">
                ${header}
              </td>
            </tr>
            <tr>
              <td style="height:4px;background:#b91c1c;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:26px 24px 28px 24px;">
                <p style="margin:0 0 18px 0;font-size:15px;color:#111827;">Good day ${escapeHtml(input.studentName)},</p>
                ${renderDetailsTable(rows)}
                <p style="margin:0 0 22px 0;font-size:15px;line-height:1.6;color:#111827;">${escapeHtml(input.instruction)}</p>
                <p style="margin:0 0 4px 0;font-size:15px;color:#111827;">Thank you,</p>
                <p style="margin:0 0 18px 0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(SCHOOL_NAME)} Registrar</p>
                <p style="margin:0;font-size:12px;color:#6b7280;">${escapeHtml(APP_NAME)} - Student Records and Document Request Management System</p>
              </td>
            </tr>
            <tr>
              <td>
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
