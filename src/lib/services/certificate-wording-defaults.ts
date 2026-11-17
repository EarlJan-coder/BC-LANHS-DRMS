import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import type { CertBlankValues } from "@/lib/services/certificate-renderer";

export interface TemplateWording {
  title: string;
  body: string;
  principalTitle: string | null;
  registrarTitle: string | null;
}

export const PLACEHOLDER_FIELDS = ["name", "grade", "schoolYear", "lrn", "purpose", "day", "month"] as const;

const GOOD_MORAL_TITLE = "CERTIFICATE OF GOOD MORAL CHARACTER";
const GOOD_MORAL_P2 =
  "This certifies further that the aforementioned student is of good moral character and has never been subjected to any disciplinary action in this institution. This certification is issued for whatever legal purpose it may serve him/her.";
const GOOD_MORAL_P3 = "Given this {{day}} day of {{month}} at Luis Aguado National High School, Trece Martires City, Cavite.";
const ENROLMENT_TITLE = "CERTIFICATE OF ENROLMENT";
const ENROLMENT_P2 = "This certificate is issued for {{purpose}} purposes.";

export const DEFAULT_WORDING: Record<CertTemplateKey, TemplateWording> = {
  "good-moral": {
    title: GOOD_MORAL_TITLE,
    body: [
      "This is to certify that {{name}} is a bonafide student of Luis Aguado National High School classified under the Grade {{grade}} strand for the school year {{schoolYear}}.",
      GOOD_MORAL_P2,
      GOOD_MORAL_P3,
    ].join("\n\n"),
    principalTitle: "Principal IV",
    registrarTitle: "School Counselor Associate 1",
  },
  "good-moral-jhs": {
    title: GOOD_MORAL_TITLE,
    body: [
      "This is to certify that {{name}} is a bonafide student of Luis Aguado National High School classified as Grade {{grade}} for the school year {{schoolYear}}.",
      GOOD_MORAL_P2,
      GOOD_MORAL_P3,
    ].join("\n\n"),
    principalTitle: "Principal IV",
    registrarTitle: "School Counselor Associate 1",
  },
  "enrolment-jhs": {
    title: ENROLMENT_TITLE,
    body: [
      "This is to certify that {{name}}, bearing Learner Reference Number {{lrn}}, is a student of LUIS AGUADO NATIONAL HIGH SCHOOL for school year {{schoolYear}}, classified as Grade {{grade}}.",
      ENROLMENT_P2,
    ].join("\n\n"),
    principalTitle: "Principal IV",
    registrarTitle: null,
  },
  "enrolment-shs": {
    title: ENROLMENT_TITLE,
    body: [
      "This is to certify that {{name}}, bearing Learner Reference Number {{lrn}}, is a student of LUIS AGUADO NATIONAL HIGH SCHOOL for school year {{schoolYear}}, classified under the Grade {{grade}} strand.",
      ENROLMENT_P2,
    ].join("\n\n"),
    principalTitle: "Principal IV",
    registrarTitle: null,
  },
  graduation: {
    title: "CERTIFICATE OF GRADUATION",
    body: [
      "This is to certify that {{name}} is a **GRADUATE** of LUIS AGUADO NATIONAL HIGH SCHOOL for school year {{schoolYear}} and successfully completed the academic requirements for Basic Academic Secondary Education Course.",
      "Issued upon request.",
    ].join("\n\n"),
    principalTitle: "Principal IV",
    registrarTitle: null,
  },
};

export const SAMPLE_BLANKS: Record<CertTemplateKey, CertBlankValues> = {
  "good-moral": {
    name: "Maria Clara Santos Dela Cruz",
    grade: "11 - STEM",
    schoolYear: "2026-2027",
    day: "12",
    month: "November 2026",
  },
  "good-moral-jhs": {
    name: "Maria Clara Santos Dela Cruz",
    grade: "9 - Diamond",
    schoolYear: "2026-2027",
    day: "12",
    month: "November 2026",
  },
  "enrolment-jhs": {
    name: "Juan Miguel Reyes",
    lrn: "123456789012",
    schoolYear: "2026-2027",
    grade: "9 - Diamond",
    purpose: "scholarship application",
  },
  "enrolment-shs": {
    name: "Ana Lucia Fernandez",
    lrn: "123456789013",
    schoolYear: "2026-2027",
    grade: "12 - STEM",
    purpose: "scholarship",
  },
  graduation: {
    name: "Rafael Antonio Mabini Bautista",
    schoolYear: "2026-2027",
  },
};

export const WORST_CASE_BLANKS: Record<(typeof PLACEHOLDER_FIELDS)[number], string> = {
  name: "Maria Clara Santos Dela Cruz Bautista",
  grade: "12 - Home Economics",
  schoolYear: "2025-2026",
  lrn: "123456789012",
  purpose: "scholarship application and board examination",
  day: "31",
  month: "September 2026",
};
