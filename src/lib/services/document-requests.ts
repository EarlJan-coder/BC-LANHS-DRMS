import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
import { ensureCurrentDbUser, getCurrentProfile } from "@/lib/auth";
import { sendWorkflowEmail } from "@/lib/email";
import { generateTrackingNumber } from "@/lib/utils";
import { documentRequestSchema, updateRequestStatusSchema } from "@/lib/validators";
import { getDocumentRequestView } from "@/lib/services/live-data";
import { recordAuditedAction } from "./audit-log";

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
      newStatus: "pending",
      toStatus: "pending",
      actorUserId: user?.id,
      changedBy: user?.id,
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

export async function generateRequestSlipPdf(requestId: string) {
  const request = await getDocumentRequestView(requestId, true);
  if (!request) {
    throw new Error("Document request not found.");
  }

  const pdfDoc = await PDFDocument.create();
  const [font, boldFont] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
  ]);

  const page = pdfDoc.addPage([612, 792]);
  const left = 50;
  let y = 740;

  page.drawText("LANHS Document Request Slip", {
    x: left,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  y -= 36;
  page.drawText(`Tracking Number: ${request.trackingNumber}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Student: ${request.studentName}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Document Type: ${request.documentType}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Purpose: ${request.purpose}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Requested: ${request.requestedAt}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Status: ${request.status.replaceAll("_", " ")}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`School Year Needed: ${request.schoolYearNeeded}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Grade Level Needed: ${request.gradeLevelNeeded}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });
  y -= 18;
  page.drawText(`Remarks: ${request.remarks}`, { x: left, y, size: 12, font, color: rgb(0, 0, 0) });

  y -= 40;
  page.drawText("Generated by LANHS DRMS", { x: left, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });

  return pdfDoc.save();
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
      oldStatus: previousStatus,
      newStatus: values.status,
      fromStatus: previousStatus,
      toStatus: values.status,
      changedBy: actor?.id,
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
