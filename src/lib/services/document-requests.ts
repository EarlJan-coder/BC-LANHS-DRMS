import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  documentRequests,
  documentTypes,
  notifications,
  requestStatusHistory,
  students,
  type RequestStatus,
  type UserRole,
} from "@/db/schema";
import { ensureCurrentDbUser, getCurrentProfile } from "@/lib/auth";
import { generateTrackingNumber } from "@/lib/utils";
import { documentRequestSchema, updateRequestStatusSchema } from "@/lib/validators";
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
  }

  const audit = await recordAuditedAction({
    referenceId: trackingNumber,
    action: "Document request submitted",
    actorRole: profile.role,
    actorUserId,
    entityType: "document_request",
    entityId: requestId,
    metadata: {
      documentType: values.documentType,
      status: "pending",
    },
    hashMetadata: {
      documentType: values.documentType,
      status: "pending",
    },
  });

  return {
    id: requestId,
    trackingNumber,
    status: "pending" as RequestStatus,
    ...audit,
  };
}

export async function updateDocumentRequestStatus(requestId: string, input: unknown, actorRole: UserRole = "registrar") {
  const values = updateRequestStatusSchema.parse(input);
  let referenceId = requestId;
  let previousStatus: RequestStatus | undefined;

  if (db) {
    const [existing] = await db.select().from(documentRequests).where(eq(documentRequests.id, requestId)).limit(1);
    previousStatus = existing?.status;
    referenceId = existing?.trackingNumber ?? requestId;

    await db
      .update(documentRequests)
      .set({
        status: values.status,
        rejectionReason: values.rejectionReason,
        updatedAt: new Date(),
        readyAt: values.status === "ready_for_pickup" ? new Date() : existing?.readyAt,
        claimedAt: values.status === "claimed" ? new Date() : existing?.claimedAt,
      })
      .where(eq(documentRequests.id, requestId));

    await db.insert(requestStatusHistory).values({
      requestId,
      fromStatus: previousStatus,
      toStatus: values.status,
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
    referenceId,
    action,
    actorRole,
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
