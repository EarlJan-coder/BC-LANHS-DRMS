import { listCertificateViews } from "@/lib/services/certificates";
import {
  listCurrentUserNotifications,
  listAuditTrailViews,
  listDocumentRequestViews,
  listDocumentTypeViews,
  listStudentViews,
  listUserViews,
  getCurrentStudentProfile,
} from "@/lib/services/live-data";
import { listPendingRegistrations } from "@/lib/services/registrations";
import { navigationByRole } from "@/lib/navigation";
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

const pageDescriptions: Record<string, string> = {
  Dashboard: "overview summary activity",
  "Submit request": "new document application school records",
  "My requests": "tracking status document history",
  Profile: "personal information address contact details learner reference number",
  Requests: "document queue tracking pending review",
  Registrations: "pending student alumni account approval",
  "Student records": "student alumni LRN school year contact details",
  Certificates: "generated documents verification certificate number",
  Reports: "export PDF summaries request statistics student records",
  Logs: "audit history activity record hashes",
  Users: "registered accounts access roles status",
  "Document types": "processing days fees requirements enable deactivate",
  "Document template": "certificate wording signatories registrar principal",
  "Blockchain trail": "audit records hashes transactions verification",
  Settings: "system configuration signup email health",
  Notifications: "updates alerts request status registration",
};

function pageCandidates(role: DashboardRole): Candidate[] {
  const pages = navigationByRole[role].map((item) => ({
    label: item.label,
    href: item.href,
    description: pageDescriptions[item.label] ?? "portal page",
  }));
  pages.push({
    label: "Notifications",
    href: `/${role}/notifications`,
    description: pageDescriptions.Notifications,
  });

  return pages.map(({ label, href, description }) => ({
    hit: { id: href, title: label, subtitle: description, meta: "Page", href },
    haystack: [label, description, href],
  }));
}

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
    const [requests, documents, notifications, profile] = await Promise.all([
      listDocumentRequestViews({ currentUserOnly: true, all: true }),
      listDocumentTypeViews(),
      listCurrentUserNotifications(undefined),
      getCurrentStudentProfile(),
    ]);

    return [
      buildGroup("pages", "Portal pages", undefined, pageCandidates(role), query, pages.pages ?? 1),
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
          haystack: [request.trackingNumber, request.documentType, request.purpose, request.studentName, request.lrn, request.schoolYearNeeded, request.gradeLevelNeeded, request.strandNeeded, request.sectionNeeded, request.remarks, request.registrarRemarks, statusLabel(request.status)],
        })),
        query,
        pages.requests ?? 1,
      ),
      buildGroup(
        "documents",
        "Available documents",
        "/student/requests/new",
        documents.filter((document) => document.isActive).map((document) => ({
          hit: { id: document.id, title: document.name, subtitle: `${document.processingDays} days processing`, meta: document.fee > 0 ? `₱${document.fee.toFixed(2)}` : "No fee", href: "/student/requests/new" },
          haystack: [document.name, document.description, document.processingDays.toString(), document.fee.toString(), document.status, ...document.requirements],
        })),
        query,
        pages.documents ?? 1,
      ),
      buildGroup(
        "profile",
        "My profile",
        "/student/profile",
        [{
          hit: { id: "profile", title: profile.name, subtitle: profile.email, meta: profile.lrn || "Not set", href: "/student/profile" },
          haystack: [profile.name, profile.email, profile.lrn, profile.contactNumber, profile.address, profile.lastSchoolYearAttended],
        }],
        query,
        pages.profile ?? 1,
      ),
      buildGroup(
        "notifications",
        "Notifications",
        "/student/notifications",
        notifications.map((notification) => ({
          hit: { id: notification.id, title: notification.title, subtitle: notification.message, meta: notification.isRead ? "Read" : "Unread", href: "/student/notifications" },
          haystack: [notification.title, notification.message, notification.isRead ? "read" : "unread", notification.createdAt.toISOString()],
        })),
        query,
        pages.notifications ?? 1,
      ),
    ];
  }

  if (role === "registrar") {
    const [requests, students, certificates, auditTrail, registrations, notifications] = await Promise.all([
      listDocumentRequestViews({ all: true }),
      listStudentViews({ all: true }),
      listCertificateViews({ all: true }),
      listAuditTrailViews({ all: true }),
      listPendingRegistrations(),
      listCurrentUserNotifications(undefined),
    ]);

    return [
      buildGroup("pages", "Portal pages", undefined, pageCandidates(role), query, pages.pages ?? 1),
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
          haystack: [request.trackingNumber, request.documentType, request.purpose, request.studentName, request.lrn, request.schoolYearNeeded, request.gradeLevelNeeded, request.strandNeeded, request.sectionNeeded, request.remarks, request.registrarRemarks, statusLabel(request.status)],
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
          haystack: [student.name, student.lrn, student.email, student.phone, student.address, student.lastSchoolYearAttended, student.status, student.registrationStatus],
        })),
        query,
        pages.students ?? 1,
      ),
      buildGroup(
        "registrations",
        "Pending registrations",
        "/registrar/registrations",
        registrations.map((registration) => ({
          hit: { id: registration.id, title: registration.name, subtitle: `${registration.email} · LRN ${registration.lrn}`, meta: registration.studentStatus, href: "/registrar/registrations" },
          haystack: [registration.name, registration.email, registration.lrn, registration.studentStatus, registration.schoolYear, registration.createdAt],
        })),
        query,
        pages.registrations ?? 1,
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
            certificate.blockchainStatus,
            certificate.generatedAt,
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
      buildGroup(
        "notifications",
        "Notifications",
        "/registrar/notifications",
        notifications.map((notification) => ({
          hit: { id: notification.id, title: notification.title, subtitle: notification.message, meta: notification.isRead ? "Read" : "Unread", href: "/registrar/notifications" },
          haystack: [notification.title, notification.message, notification.isRead ? "read" : "unread", notification.createdAt.toISOString()],
        })),
        query,
        pages.notifications ?? 1,
      ),
    ];
  }

  const [users, documentTypes, auditTrail, registrations, notifications, requests, students, certificates] = await Promise.all([
    listUserViews({ all: true }),
    listDocumentTypeViews(),
    listAuditTrailViews({ all: true }),
    listPendingRegistrations(),
    listCurrentUserNotifications(undefined),
    listDocumentRequestViews({ all: true }),
    listStudentViews({ all: true }),
    listCertificateViews({ all: true }),
  ]);

  return [
    buildGroup("pages", "Portal pages", undefined, pageCandidates(role), query, pages.pages ?? 1),
    buildGroup("requests", "Document requests", "/admin/requests", requests.map((request) => ({
      hit: { id: request.id, title: request.trackingNumber, subtitle: `${request.documentType} — ${request.studentName}`, meta: statusLabel(request.status), href: `/admin/requests/${request.id}` },
      haystack: [request.trackingNumber, request.documentType, request.purpose, request.studentName, request.lrn, request.gradeLevelNeeded, statusLabel(request.status)],
    })), query, pages.requests ?? 1),
    buildGroup("students", "Student records", "/admin/users#student-records", students.map((student) => ({
      hit: { id: student.id, title: student.name, subtitle: `LRN ${student.lrn || "Not set"}`, meta: student.status, href: `/admin/users/${student.id}` },
      haystack: [student.name, student.lrn, student.email, student.phone, student.address, student.lastSchoolYearAttended, student.status],
    })), query, pages.students ?? 1),
    buildGroup("certificates", "Certificates", "/admin/certificates", certificates.map((certificate) => ({
      hit: { id: certificate.id, title: certificate.certificateNumber, subtitle: `${certificate.certificateType} — ${certificate.studentName}`, meta: certificate.blockchainStatus, href: `/admin/certificates/${certificate.id}` },
      haystack: [certificate.certificateNumber, certificate.certificateType, certificate.studentName, certificate.schoolYear, certificate.verificationCode, certificate.blockchainStatus],
    })), query, pages.certificates ?? 1),
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
        haystack: [user.name, user.email, user.role, user.status, user.registrationStatus],
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
          subtitle: `${documentType.processingDays} days processing`,
          meta: documentType.status,
          href: "/admin/document-types",
        },
        haystack: [documentType.name, documentType.description, documentType.processingDays.toString(), documentType.fee.toString(), documentType.status, ...documentType.requirements],
      })),
      query,
      pages["document-types"] ?? 1,
    ),
    buildGroup(
      "registrations",
      "Pending registrations",
      "/admin/registrations",
      registrations.map((registration) => ({
        hit: { id: registration.id, title: registration.name, subtitle: `${registration.email} · LRN ${registration.lrn}`, meta: registration.studentStatus, href: "/admin/registrations" },
        haystack: [registration.name, registration.email, registration.lrn, registration.studentStatus, registration.schoolYear, registration.createdAt],
      })),
      query,
      pages.registrations ?? 1,
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
    buildGroup(
      "notifications",
      "Notifications",
      "/admin/notifications",
      notifications.map((notification) => ({
        hit: { id: notification.id, title: notification.title, subtitle: notification.message, meta: notification.isRead ? "Read" : "Unread", href: "/admin/notifications" },
        haystack: [notification.title, notification.message, notification.isRead ? "read" : "unread", notification.createdAt.toISOString()],
      })),
      query,
      pages.notifications ?? 1,
    ),
  ];
}
