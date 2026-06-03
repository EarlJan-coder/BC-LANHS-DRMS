import type { RequestStatus, UserRole } from "@/db/schema";

export const APP_NAME = "LANHS DRMS";
export const SCHOOL_NAME = "Luis Aguado National High School";

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Student / Alumni",
  registrar: "Registrar / Staff",
  admin: "Administrator",
};

export const REQUEST_STATUSES: Array<{ value: RequestStatus; label: string; tone: string }> = [
  { value: "pending", label: "Pending", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { value: "under_review", label: "Under Review", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  { value: "approved", label: "Approved", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { value: "rejected", label: "Rejected", tone: "bg-red-50 text-red-700 ring-red-200" },
  { value: "processing", label: "Processing", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  { value: "ready_for_pickup", label: "Ready for Pickup", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  { value: "claimed", label: "Claimed", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  { value: "cancelled", label: "Cancelled", tone: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
];

export const DOCUMENT_TYPES = [
  "Certificate of Grades",
  "Good Moral Certificate",
  "Certificate of Enrollment",
  "Certificate of Graduation",
  "Form 137",
  "Diploma-related request",
  "Other school documents",
];

export const GRADE_IMPORT_COLUMNS = [
  "LRN",
  "Student Number",
  "School Year",
  "Grade Level",
  "Section",
  "Subject",
  "Quarter 1",
  "Quarter 2",
  "Quarter 3",
  "Quarter 4",
  "Final Grade",
  "Remarks",
];

export const BLOCKCHAIN_ACTIONS = [
  "Document request submitted",
  "Request approved",
  "Request rejected",
  "Request status updated",
  "Grades imported",
  "Certificate generated",
  "Document claimed",
];

