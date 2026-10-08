import { listCertificateViews } from "@/lib/services/certificates";
import {
  listAuditTrailViews,
  listDocumentRequestViews,
  listDocumentTypeViews,
  listSectionViews,
  listStudentViews,
  listSubjectViews,
  listUserViews,
} from "@/lib/services/live-data";
import type { DashboardRole } from "@/lib/types";
import { statusLabel } from "@/lib/utils";

export type SearchHit = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  viewAllHref?: string;
  hits: SearchHit[];
  total: number;
};

const HITS_PER_GROUP = 5;

type Candidate = {
  hit: SearchHit;
  haystack: Array<string | null | undefined>;
};

function buildGroup(
  key: string,
  label: string,
  viewAllHref: string | undefined,
  candidates: Candidate[],
  query: string,
): SearchGroup {
  const matched = candidates.filter((candidate) =>
    candidate.haystack.some((value) => (value ?? "").toLowerCase().includes(query)),
  );

  return {
    key,
    label,
    viewAllHref,
    hits: matched.slice(0, HITS_PER_GROUP).map((candidate) => candidate.hit),
    total: matched.length,
  };
}

export async function searchPortal(role: DashboardRole, rawQuery: string): Promise<SearchGroup[]> {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  if (role === "student") {
    const requests = await listDocumentRequestViews({ currentUserOnly: true });

    return [
      buildGroup(
        "requests",
        "My requests",
        "/student/requests",
        requests.map((request) => ({
          hit: {
            id: request.id,
            title: request.trackingNumber,
            subtitle: `${request.documentType} — ${request.studentName}`,
            meta: statusLabel(request.status),
            href: `/student/requests/${request.id}`,
          },
          haystack: [request.trackingNumber, request.documentType, request.purpose, request.studentName, request.lrn],
        })),
        query,
      ),
    ];
  }

  if (role === "registrar") {
    const [requests, students, certificates, auditTrail] = await Promise.all([
      listDocumentRequestViews(),
      listStudentViews(),
      listCertificateViews(),
      listAuditTrailViews(),
    ]);

    return [
      buildGroup(
        "requests",
        "Document requests",
        "/registrar/requests",
        requests.map((request) => ({
          hit: {
            id: request.id,
            title: request.trackingNumber,
            subtitle: `${request.documentType} — ${request.studentName}`,
            meta: statusLabel(request.status),
            href: `/registrar/requests/${request.id}`,
          },
          haystack: [request.trackingNumber, request.documentType, request.purpose, request.studentName, request.lrn],
        })),
        query,
      ),
      buildGroup(
        "students",
        "Student records",
        "/registrar/students",
        students.map((student) => ({
          hit: {
            id: student.id,
            title: student.name,
            subtitle: `LRN ${student.lrn} · ${student.gradeLevel} · ${student.section}`,
            meta: student.status,
            href: `/registrar/students/${student.id}`,
          },
          haystack: [student.name, student.lrn, student.gradeLevel, student.section, student.status],
        })),
        query,
      ),
      buildGroup(
        "certificates",
        "Certificates",
        "/registrar/certificates",
        certificates.map((certificate) => ({
          hit: {
            id: certificate.id,
            title: certificate.certificateNumber,
            subtitle: `${certificate.certificateType} — ${certificate.studentName}`,
            meta: certificate.blockchainStatus,
            href: `/registrar/certificates/${certificate.id}`,
          },
          haystack: [
            certificate.certificateNumber,
            certificate.certificateType,
            certificate.studentName,
            certificate.schoolYear,
            certificate.verificationCode,
          ],
        })),
        query,
      ),
      buildGroup(
        "audit",
        "Audit logs",
        "/registrar/audit-logs",
        auditTrail.map((entry) => ({
          hit: {
            id: entry.id,
            title: entry.action,
            subtitle: `Reference ${entry.referenceId}`,
            meta: entry.status,
            href: "/registrar/audit-logs",
          },
          haystack: [entry.action, entry.referenceId, entry.hash, entry.transactionHash, entry.actorRole],
        })),
        query,
      ),
    ];
  }

  const [users, documentTypes, subjects, sections, auditTrail] = await Promise.all([
    listUserViews(),
    listDocumentTypeViews(),
    listSubjectViews(),
    listSectionViews(),
    listAuditTrailViews(),
  ]);

  return [
    buildGroup(
      "users",
      "Users",
      "/admin/users",
      users.map((user) => ({
        hit: {
          id: user.id,
          title: user.name,
          subtitle: user.email,
          meta: user.role,
          href: "/admin/users",
        },
        haystack: [user.name, user.email, user.role],
      })),
      query,
    ),
    buildGroup(
      "document-types",
      "Document types",
      "/admin/document-types",
      documentTypes.map((documentType) => ({
        hit: {
          id: documentType.id,
          title: documentType.name,
          subtitle: `Code ${documentType.code} · ${documentType.processingDays} days processing`,
          meta: documentType.status,
          href: "/admin/document-types",
        },
        haystack: [documentType.name, documentType.code],
      })),
      query,
    ),
    buildGroup(
      "subjects",
      "Subjects",
      "/admin/subjects",
      subjects.map((subject) => ({
        hit: {
          id: subject.id,
          title: subject.name,
          subtitle: `${subject.code} · ${subject.gradeLevel}`,
          href: "/admin/subjects",
        },
        haystack: [subject.name, subject.code, subject.gradeLevel],
      })),
      query,
    ),
    buildGroup(
      "sections",
      "Sections",
      "/admin/sections",
      sections.map((section) => ({
        hit: {
          id: section.id,
          title: section.name,
          subtitle: `${section.gradeLevel} · Adviser ${section.adviserName}`,
          meta: section.status,
          href: "/admin/sections",
        },
        haystack: [section.name, section.gradeLevel, section.adviserName, section.schoolYear],
      })),
      query,
    ),
    buildGroup(
      "blockchain",
      "Blockchain audit trail",
      "/admin/blockchain",
      auditTrail.map((entry) => ({
        hit: {
          id: entry.id,
          title: entry.action,
          subtitle: `Reference ${entry.referenceId}`,
          meta: entry.status,
          href: "/admin/blockchain",
        },
        haystack: [entry.action, entry.referenceId, entry.hash, entry.transactionHash, entry.actorRole],
      })),
      query,
    ),
  ];
}
