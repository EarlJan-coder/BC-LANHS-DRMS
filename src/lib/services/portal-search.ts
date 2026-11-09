import { listCertificateViews } from "@/lib/services/certificates";
import {
  listAuditTrailViews,
  listDocumentRequestViews,
  listDocumentTypeViews,
  listStudentViews,
  listUserViews,
} from "@/lib/services/live-data";
import type { DashboardRole } from "@/lib/types";
import { statusLabel } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/pagination";

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
  page: number;
  pageSize: number;
};

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
  page: number,
): SearchGroup {
  const matched = candidates.filter((candidate) =>
    candidate.haystack.some((value) => (value ?? "").toLowerCase().includes(query)),
  );
  const pageSize = PAGE_SIZE;
  const safePage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(matched.length / pageSize)));

  return {
    key,
    label,
    viewAllHref,
    hits: matched.slice((safePage - 1) * pageSize, safePage * pageSize).map((candidate) => candidate.hit),
    total: matched.length,
    page: safePage,
    pageSize,
  };
}

export async function searchPortal(role: DashboardRole, rawQuery: string, pages: Record<string, number> = {}): Promise<SearchGroup[]> {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  if (role === "student") {
    const requests = await listDocumentRequestViews({ currentUserOnly: true, all: true });

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
        pages.requests ?? 1,
      ),
    ];
  }

  if (role === "registrar") {
    const [requests, students, certificates, auditTrail] = await Promise.all([
      listDocumentRequestViews({ all: true }),
      listStudentViews({ all: true }),
      listCertificateViews({ all: true }),
      listAuditTrailViews({ all: true }),
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
        pages.requests ?? 1,
      ),
      buildGroup(
        "students",
        "Student records",
        "/registrar/students",
        students.map((student) => ({
          hit: {
            id: student.id,
            title: student.name,
            subtitle: `LRN ${student.lrn}`,
            meta: student.status,
            href: `/registrar/students/${student.id}`,
          },
          haystack: [student.name, student.lrn, student.status],
        })),
        query,
        pages.students ?? 1,
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
        pages.certificates ?? 1,
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
        pages.audit ?? 1,
      ),
    ];
  }

  const [users, documentTypes, auditTrail] = await Promise.all([
    listUserViews({ all: true }),
    listDocumentTypeViews(),
    listAuditTrailViews({ all: true }),
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
      pages.users ?? 1,
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
      pages["document-types"] ?? 1,
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
      pages.blockchain ?? 1,
    ),
  ];
}
