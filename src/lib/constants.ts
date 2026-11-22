import type { RequestStatus, UserRole } from "@/db/schema";

export const APP_NAME = "LANHS DRMS";
export const SCHOOL_NAME = "Luis Aguado National High School";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student",
  registrar: "Registrar",
  admin: "Administrator",
};

export const REQUEST_STATUSES: Array<{ value: RequestStatus; label: string; tone: string }> = [
  { value: "pending", label: "Pending", tone: "bg-yellow-50 text-yellow-700 ring-yellow-200" },
  { value: "under_review", label: "Under Review", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "approved", label: "Approved", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "rejected", label: "Rejected", tone: "bg-red-50 text-red-700 ring-red-200" },
  { value: "processing", label: "Processing", tone: "bg-purple-50 text-purple-700 ring-purple-200" },
  { value: "ready_for_pickup", label: "Ready for Pickup", tone: "bg-teal-50 text-teal-700 ring-teal-200" },
  { value: "claimed", label: "Claimed", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  { value: "cancelled", label: "Cancelled", tone: "bg-zinc-200 text-zinc-800 ring-zinc-300" },
];

/** Only this status unlocks a student's request-slip download. Staff bypass
 * the gate (see `canAccessRequestSlip`), so it is enforced in one place on
 * the server and read from here by the student-facing UI. */
export const SLIP_DOWNLOAD_STATUS: RequestStatus = "ready_for_pickup";

/** Shown wherever the slip download is locked: a hover tooltip on the disabled
 * control, a visible hint on the request detail page, and the 403 the slip
 * endpoint returns to an owner who tries early. */
export const SLIP_DOWNLOAD_HINT = "Available once your document is Ready for Pickup";

export const DOCUMENT_TYPES = [
  "Good Moral Certificate",
  "Certificate of Enrollment",
  "Certificate of Graduation",
  "Form 137",
  "Diploma-related request",
];

/** Predefined decline reasons; the confirm dialog appends an "Other" option. */
export const REGISTRATION_DECLINE_REASONS = [
  "Incomplete requirements",
  "Invalid or unverifiable LRN",
  "Duplicate registration",
  "Not enrolled this school year",
];

/** Predefined rejection reasons for document requests; the dialog appends "Other". */
export const REQUEST_REJECT_REASONS = [
  "Missing requirements",
  "Incorrect or incomplete information",
  "Duplicate request",
  "Not eligible for this document",
];

/** Common reasons for requesting a school document in the Philippines; the
 * request form appends "Other" and reveals a free-text field for it. */
export const DOCUMENT_REQUEST_REASONS = [
  "School requirement / enrollment requirement",
  "Transfer to another school",
  "Scholarship application",
  "Employment requirement",
  "Civil service / Licensure exam (PRC, CSC)",
  "Government ID / agency requirement",
  "Personal copy / backup",
];

// Grade levels selectable on document requests (drives the certificate template).
export const GRADE_LEVELS = ["7", "8", "9", "10", "11", "12"];

// Senior high strands per the current DepEd senior high curriculum. Shown only
// when the requested grade is 11 or 12.
export const SHS_STRANDS = ["ABM", "HUMSS"];

export const SCHOOL_ADDRESS = "Luis Aguado National High School, Philippines";
