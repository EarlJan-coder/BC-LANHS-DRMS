import type { RequestStatus } from "@/db/schema";

export type StatusColor = "green" | "red" | "amber" | "blue" | "purple";

export interface RequestAction {
  status: RequestStatus;
  label: string;
  color: StatusColor;
  confirm: string;
}

export const REQUEST_ACTIONS: RequestAction[] = [
  { status: "approved", label: "Approved", color: "green", confirm: "Approve this document request?" },
  { status: "rejected", label: "Reject", color: "red", confirm: "Reject this document request?" },
  { status: "processing", label: "Processing", color: "amber", confirm: "Mark this request as processing?" },
  { status: "ready_for_pickup", label: "Ready for Pickup", color: "blue", confirm: "Mark this document as ready for pickup?" },
  { status: "claimed", label: "Claimed", color: "purple", confirm: "Mark this document as claimed?" },
];

export interface StatusUpdatePayload {
  status: RequestStatus;
  remarks: string;
  registrarRemarks: string;
  rejectionReason?: string;
}

export function buildStatusUpdatePayload(
  status: RequestStatus,
  rejectionReason?: string,
): StatusUpdatePayload | null {
  const trimmedReason = rejectionReason?.trim();

  if (status === "rejected") {
    if (!trimmedReason) {
      return null;
    }
    return {
      status,
      remarks: `Status updated to ${status}.`,
      registrarRemarks: `Registrar rejected this request. Reason: ${trimmedReason}`,
      rejectionReason: trimmedReason,
    };
  }

  return {
    status,
    remarks: `Status updated to ${status}.`,
    registrarRemarks: `Registrar marked this request as ${status.replaceAll("_", " ")}.`,
  };
}

/**
 * Staircase lock for the registrar status buttons: each later workflow stage
 * disables the buttons of the stages before it. Approve and reject are
 * one-way decisions — the approve/reject pair locks as soon as either is
 * chosen (rejecting is terminal and locks the whole row), because approving
 * now issues the certificate automatically and must not be replayed.
 */
const ALL_ACTIONS: readonly RequestStatus[] = ["approved", "rejected", "processing", "ready_for_pickup", "claimed"];

const DISABLED_ACTIONS_BY_STATUS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: [],
  under_review: [],
  approved: ["approved", "rejected"],
  rejected: ALL_ACTIONS,
  processing: ["approved", "rejected"],
  ready_for_pickup: ["approved", "rejected", "processing"],
  claimed: ["approved", "rejected", "processing", "ready_for_pickup"],
  cancelled: [],
};

/** The status action buttons that must be disabled while the request sits in `currentStatus`. */
export function disabledStatusActions(currentStatus?: RequestStatus): readonly RequestStatus[] {
  return currentStatus ? DISABLED_ACTIONS_BY_STATUS[currentStatus] : [];
}
