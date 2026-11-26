export type RequestReviewInput = {
  documentType: string;
  reason: string;
  purpose: string;
  gradeLevel: string;
  strandNeeded: string;
  sectionNeeded: string;
  remarks: string;
};

export function buildRequestReviewRows(input: RequestReviewInput): { label: string; value: string }[] {
  const valueOr = (value: string, fallback: string) => value.trim() || fallback;
  const grade = input.gradeLevel.trim().replace(/^grade\s*/i, "");
  const rows = [
    { label: "Document type", value: valueOr(input.documentType, "Not set") },
    { label: "Reason for requesting", value: valueOr(input.reason, "Not set") },
  ];

  if (input.reason === "Other") {
    rows.push({ label: "Purpose", value: valueOr(input.purpose, "Not set") });
  }

  rows.push(
    { label: "Grade level", value: grade ? `Grade ${grade}` : "Not set" },
    { label: "Strand", value: valueOr(input.strandNeeded, "Not set") },
    { label: "Section", value: valueOr(input.sectionNeeded, "Not set") },
    { label: "Remarks", value: valueOr(input.remarks, "None") },
  );
  return rows;
}
