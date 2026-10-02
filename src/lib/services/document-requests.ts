import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import { db } from "@/db";
import {
  documentRequests,
  documentTypes,
  notifications,
  requestStatusHistory,
  students,
  users,
  type RequestStatus,
  type UserRole,
} from "@/db/schema";
import { ensureCurrentDbUser, getCurrentProfile, getCurrentRole } from "@/lib/auth";
import { REQUEST_STATUSES } from "@/lib/constants";
import { AppError } from "@/lib/utils";
import { sendWorkflowEmail } from "@/lib/email";
import { generateTrackingNumber } from "@/lib/utils";
import { documentRequestSchema, updateRequestStatusSchema } from "@/lib/validators";
import { getDocumentRequestView } from "@/lib/services/live-data";
import type { DocumentRequestView } from "@/lib/types";
import { recordAuditedAction } from "./audit-log";
import {
  appUrl,
  BRAND_RED,
  DARK_TEXT,
  drawCenteredText,
  drawDocumentHeader,
  drawSignatureLine,
  embedQrCode,
  embedSchoolLogo,
  LIGHT_BORDER,
  MUTED_TEXT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  wrapText,
} from "./pdf-brand";

export type EligibilityReason = "no_record" | "no_lrn";

export interface RequestEligibility {
  eligible: boolean;
  reason: EligibilityReason | null;
}

export async function getRequestEligibility(
  user?: Awaited<ReturnType<typeof ensureCurrentDbUser>>
): Promise<RequestEligibility> {
  if (!db) {
    return { eligible: true, reason: null };
  }

  const resolvedUser = user ?? (await ensureCurrentDbUser());
  const role = resolvedUser?.role ?? (await getCurrentRole());

  if (role !== "student") {
    return { eligible: true, reason: null };
  }

  if (!resolvedUser) {
    return { eligible: false, reason: "no_record" };
  }

  const student = await db.query.students.findFirst({
    where: eq(students.userId, resolvedUser.id),
  });

  if (!student) {
    return { eligible: false, reason: "no_record" };
  }

  if (!student.lrn || student.lrn.trim() === "") {
    return { eligible: false, reason: "no_lrn" };
  }

  return { eligible: true, reason: null };
}

export async function createDocumentRequest(input: unknown) {
  const values = documentRequestSchema.parse(input);
  const profile = await getCurrentProfile();
  const trackingNumber = generateTrackingNumber();

  let requestId = trackingNumber;
  let actorUserId: string | undefined;

  if (db) {
    const user = await ensureCurrentDbUser();
    actorUserId = user?.id;
    const student = user
      ? await db.query.students.findFirst({
          where: eq(students.userId, user.id),
        })
      : undefined;

    const eligibility = await getRequestEligibility(user);
    if (!eligibility.eligible) {
      const message =
        eligibility.reason === "no_record"
          ? "We couldn't find a student record for your account. Set up your profile and add your LRN before submitting a document request."
          : "Your student profile has no LRN yet. Add your Learner Reference Number on your profile page before submitting a document request.";
      throw new AppError(message, 403);
    }

    const [documentType] = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.name, values.documentType))
      .limit(1);

    const [request] = await db
      .insert(documentRequests)
      .values({
        trackingNumber,
        studentId: student?.id,
        requestedByUserId: user?.id,
        documentTypeId: documentType?.id,
        purpose: values.purpose,
        schoolYearNeeded: values.schoolYearNeeded,
        gradeLevelNeeded: values.gradeLevelNeeded,
        remarks: values.remarks,
        status: "pending",
      })
      .returning();

    requestId = request.id;

    await db.insert(requestStatusHistory).values({
      requestId: request.id,
      toStatus: "pending",
      actorUserId: user?.id,
      remarks: "Request submitted online.",
    });

    if (user?.id) {
      await db.insert(notifications).values({
        userId: user.id,
        type: "request",
        title: "Document request submitted",
        message: `Your request ${trackingNumber} was submitted and is pending registrar review.`,
      });
    }

    await sendWorkflowEmail({
      to: profile.email,
      studentName: `${profile.firstName} ${profile.lastName}`,
      trackingNumber,
      documentType: values.documentType,
      status: "pending",
      subject: `LANHS DRMS request submitted: ${trackingNumber}`,
      instruction: "Your document request was received and is now pending registrar review.",
    });
  }

  const audit = await recordAuditedAction({
    referenceType: "document_request",
    referenceId: trackingNumber,
    action: "Document request submitted",
    actorRole: profile.role,
    actorUserId,
    entityType: "document_request",
    entityId: requestId,
    metadata: {
      documentType: values.documentType,
      status: "pending",
      schoolYearNeeded: values.schoolYearNeeded,
      gradeLevelNeeded: values.gradeLevelNeeded,
    },
    hashMetadata: {
      documentType: values.documentType,
      status: "pending",
      schoolYearNeeded: values.schoolYearNeeded,
      gradeLevelNeeded: values.gradeLevelNeeded,
    },
  });

  return {
    id: requestId,
    trackingNumber,
    status: "pending" as RequestStatus,
    ...audit,
  };
}

const STATUS_BADGE_COLORS: Record<string, RGB> = {
  pending: rgb(0.631, 0.384, 0.027),
  under_review: rgb(0.012, 0.412, 0.631),
  approved: rgb(0.016, 0.471, 0.341),
  rejected: rgb(0.725, 0.109, 0.109),
  processing: rgb(0.427, 0.157, 0.851),
  ready_for_pickup: rgb(0.059, 0.463, 0.431),
  claimed: rgb(0.2, 0.255, 0.333),
  cancelled: rgb(0.247, 0.247, 0.275),
};

export async function renderRequestSlipPdf(request: DocumentRequestView) {
  const pdfDoc = await PDFDocument.create();
  const [regular, bold] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const logo = await embedSchoolLogo(pdfDoc);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawDocumentHeader(page, logo, regular, bold);

  drawCenteredText(page, "Document Request Slip", 684, bold, 18, BRAND_RED);
  drawCenteredText(page, "Official receipt of document request", 666, regular, 9, MUTED_TEXT);

  const metaY = 644;
  const trackingLabel = "Tracking No.: ";
  page.drawText(trackingLabel, { x: 50, y: metaY, size: 9, font: regular, color: MUTED_TEXT });
  page.drawText(request.trackingNumber, {
    x: 50 + regular.widthOfTextAtSize(trackingLabel, 9),
    y: metaY,
    size: 10,
    font: bold,
    color: DARK_TEXT,
  });

  const requestedLabel = "Requested: ";
  const requestedLabelWidth = regular.widthOfTextAtSize(requestedLabel, 9);
  const requestedValueWidth = regular.widthOfTextAtSize(request.requestedAt, 9);
  const requestedX = 545 - requestedLabelWidth - requestedValueWidth;
  page.drawText(requestedLabel, { x: requestedX, y: metaY, size: 9, font: regular, color: MUTED_TEXT });
  page.drawText(request.requestedAt, {
    x: requestedX + requestedLabelWidth,
    y: metaY,
    size: 9,
    font: regular,
    color: DARK_TEXT,
  });

  page.drawRectangle({ x: 50, y: 560, width: 495, height: 72, color: rgb(1, 1, 1), borderColor: LIGHT_BORDER, borderWidth: 0.8 });

  const infoFields = [
    { x: 62, labelY: 614, valueY: 600, label: "Student Name", value: request.studentName, valueFont: bold },
    { x: 310, labelY: 614, valueY: 600, label: "LRN", value: request.lrn ?? "Not set", valueFont: regular },
    { x: 62, labelY: 578, valueY: 566, label: "Grade Level Needed", value: request.gradeLevelNeeded, valueFont: regular },
    { x: 310, labelY: 578, valueY: 566, label: "School Year Needed", value: request.schoolYearNeeded, valueFont: regular },
  ];
  for (const field of infoFields) {
    page.drawText(field.label, { x: field.x, y: field.labelY, size: 8, font: regular, color: MUTED_TEXT });
    page.drawText(field.value, { x: field.x, y: field.valueY, size: 10, font: field.valueFont, color: DARK_TEXT });
  }

  const panelTop = 548;
  const contentX = 62;
  const valueWidth = 470;
  const lineStep = 14;
  const blockGap = 20;
  const purposeLines = wrapText(regular, 10, valueWidth, request.purpose ?? "");
  const remarksLines = wrapText(regular, 10, valueWidth, request.remarks ?? "");

  let panelY = panelTop - 18;
  panelY -= lineStep + blockGap;
  if (purposeLines.length > 0) {
    panelY -= lineStep * purposeLines.length + blockGap;
  }
  if (remarksLines.length > 0) {
    panelY -= lineStep * remarksLines.length;
  }
  const panelBottom = panelY - 16;
  page.drawRectangle({
    x: 50,
    y: panelBottom,
    width: 495,
    height: panelTop - panelBottom,
    color: rgb(1, 1, 1),
    borderColor: LIGHT_BORDER,
    borderWidth: 0.8,
  });

  const badgeLabel =
    REQUEST_STATUSES.find((status) => status.value === request.status)?.label ??
    request.status.replaceAll("_", " ");
  const badgeWidth = bold.widthOfTextAtSize(badgeLabel, 9) + 16;
  const badgeHeight = 16;
  const badgeX = 533 - badgeWidth;
  const badgeY = panelTop - 8 - badgeHeight;
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: STATUS_BADGE_COLORS[request.status] ?? MUTED_TEXT,
  });
  page.drawText(badgeLabel, { x: badgeX + 8, y: badgeY + 5, size: 9, font: bold, color: rgb(1, 1, 1) });
  const statusWord = "Status";
  page.drawText(statusWord, {
    x: badgeX - 8 - regular.widthOfTextAtSize(statusWord, 8),
    y: badgeY + 5,
    size: 8,
    font: regular,
    color: MUTED_TEXT,
  });

  let y = panelTop - 18;
  page.drawText("Document Type", { x: contentX, y, size: 8, font: regular, color: MUTED_TEXT });
  y -= lineStep;
  page.drawText(request.documentType, { x: contentX, y, size: 10, font: bold, color: DARK_TEXT });
  y -= blockGap;

  if (purposeLines.length > 0) {
    page.drawText("Purpose", { x: contentX, y, size: 8, font: regular, color: MUTED_TEXT });
    purposeLines.forEach((line, index) => {
      page.drawText(line, { x: contentX, y: y - lineStep * (index + 1), size: 10, font: regular, color: DARK_TEXT });
    });
    y -= lineStep * purposeLines.length + blockGap;
  }

  if (remarksLines.length > 0) {
    page.drawText("Remarks", { x: contentX, y, size: 8, font: regular, color: MUTED_TEXT });
    remarksLines.forEach((line, index) => {
      page.drawText(line, { x: contentX, y: y - lineStep * (index + 1), size: 10, font: regular, color: DARK_TEXT });
    });
  }

  const requestedByLabel = "Requested by";
  const registrarLabel = "Registrar";
  drawSignatureLine(
    page,
    70,
    215,
    requestedByLabel,
    70 + (145 - regular.widthOfTextAtSize(requestedByLabel, 9)) / 2,
    regular,
  );
  drawSignatureLine(
    page,
    300,
    465,
    registrarLabel,
    300 + (165 - regular.widthOfTextAtSize(registrarLabel, 9)) / 2,
    regular,
  );

  const qrUrl = `${appUrl()}/student/requests/${request.id}`;
  const qrImage = await embedQrCode(pdfDoc, qrUrl);
  page.drawImage(qrImage, { x: 465, y: 132, width: 68, height: 68 });
  const qrCaption = "Scan to track request";
  page.drawText(qrCaption, {
    x: 545 - bold.widthOfTextAtSize(qrCaption, 8),
    y: 120,
    size: 8,
    font: bold,
    color: BRAND_RED,
  });

  page.drawText(
    "Generated by LANHS DRMS · This slip is system-generated and does not require a signature to be valid.",
    { x: 50, y: 62, size: 8, font: regular, color: MUTED_TEXT },
  );
  page.drawText(qrUrl, { x: 50, y: 46, size: 7, font: regular, color: MUTED_TEXT });
  page.drawText("This QR code opens the request status page.", {
    x: 50,
    y: 32,
    size: 8,
    font: regular,
    color: MUTED_TEXT,
  });

  return pdfDoc.save();
}

export async function generateRequestSlipPdf(requestId: string) {
  const request = await getDocumentRequestView(requestId, true);
  if (!request) {
    throw new Error("Document request not found.");
  }

  return renderRequestSlipPdf(request);
}

export async function updateDocumentRequestStatus(requestId: string, input: unknown, actorRole: UserRole = "registrar") {
  const values = updateRequestStatusSchema.parse(input);
  let referenceId = requestId;
  let previousStatus: RequestStatus | undefined;
  let actorUserId: string | undefined;
  let emailTarget:
    | {
        to?: string | null;
        studentName: string;
        documentType: string;
      }
    | undefined;

  if (db) {
    const actor = await ensureCurrentDbUser();
    actorUserId = actor?.id;
    const [existing] = await db.select().from(documentRequests).where(eq(documentRequests.id, requestId)).limit(1);
    previousStatus = existing?.status;
    referenceId = existing?.trackingNumber ?? requestId;

    const documentType = existing?.documentTypeId
      ? await db.query.documentTypes.findFirst({
          where: eq(documentTypes.id, existing.documentTypeId),
        })
      : undefined;
    const requester = existing?.requestedByUserId
      ? await db.query.users.findFirst({
          where: eq(users.id, existing.requestedByUserId),
        }).catch(() => undefined)
      : undefined;
    const student = existing?.studentId
      ? await db.query.students.findFirst({
          where: eq(students.id, existing.studentId),
        })
      : undefined;

    emailTarget = {
      to: student?.email ?? requester?.email,
      studentName: student
        ? [student.firstName, student.middleName, student.lastName, student.suffix].filter(Boolean).join(" ")
        : requester
          ? `${requester.firstName} ${requester.lastName}`
          : "Student",
      documentType: documentType?.name ?? "School document",
    };

    await db
      .update(documentRequests)
      .set({
        status: values.status,
        registrarRemarks: values.registrarRemarks ?? values.remarks,
        rejectionReason: values.rejectionReason,
        approvedBy: values.status === "approved" ? actor?.id : existing?.approvedBy,
        approvedAt: values.status === "approved" ? new Date() : existing?.approvedAt,
        rejectedBy: values.status === "rejected" ? actor?.id : existing?.rejectedBy,
        rejectedAt: values.status === "rejected" ? new Date() : existing?.rejectedAt,
        updatedAt: new Date(),
        readyForPickupAt: values.status === "ready_for_pickup" ? new Date() : existing?.readyForPickupAt,
        readyAt: values.status === "ready_for_pickup" ? new Date() : existing?.readyAt,
        claimedAt: values.status === "claimed" ? new Date() : existing?.claimedAt,
      })
      .where(eq(documentRequests.id, requestId));

    await db.insert(requestStatusHistory).values({
      requestId,
      fromStatus: previousStatus,
      toStatus: values.status,
      actorUserId: actor?.id,
      remarks: values.remarks,
    });

    if (existing?.requestedByUserId) {
      await db.insert(notifications).values({
        userId: existing.requestedByUserId,
        type: "request",
        title: "Document request status updated",
        message: `${referenceId} is now ${values.status.replaceAll("_", " ")}.`,
      });
    }

    await sendWorkflowEmail({
      to: emailTarget.to,
      studentName: emailTarget.studentName,
      trackingNumber: referenceId,
      documentType: emailTarget.documentType,
      status: values.status,
      subject: `LANHS DRMS request update: ${referenceId}`,
      instruction:
        values.status === "ready_for_pickup"
          ? "Your document is ready for pickup at the registrar office. Please bring a valid ID."
          : values.status === "claimed"
            ? "Your document has been marked as claimed. Thank you for using LANHS DRMS."
            : values.status === "rejected"
              ? `Your request was rejected. Reason: ${values.rejectionReason ?? "Please contact the registrar."}`
              : "Please log in to LANHS DRMS to view full request details.",
    });
  }

  const action =
    values.status === "approved"
      ? "Request approved"
      : values.status === "rejected"
        ? "Request rejected"
        : values.status === "claimed"
          ? "Document claimed"
          : "Request status updated";

  const audit = await recordAuditedAction({
    referenceType: "document_request",
    referenceId,
    action,
    actorRole,
    actorUserId,
    entityType: "document_request",
    entityId: requestId,
    metadata: {
      fromStatus: previousStatus,
      toStatus: values.status,
      remarks: values.remarks,
    },
    hashMetadata: {
      fromStatus: previousStatus,
      toStatus: values.status,
    },
  });

  return {
    id: requestId,
    trackingNumber: referenceId,
    status: values.status,
    ...audit,
  };
}
