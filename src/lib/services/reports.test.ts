import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const { eq, inArray } = await import("drizzle-orm");
const { PDFDocument } = await import("pdf-lib");
const { getDb, closeDb } = await import("@/db");
const { certificates, documentRequests, documentTypes } = await import("@/db/schema");
const {
  REPORT_KEYS,
  formatPeriodLabel,
  formatReportDate,
  formatReportDateTime,
  getReportData,
  parseReportFilters,
  parseReportRange,
  renderAllReportsPdf,
  renderReportPdf,
} = await import("@/lib/services/reports");

const hasDb = Boolean(process.env.DATABASE_URL);
let fixtureIndex = 0;

after(async () => {
  await closeDb();
});

describe("parseReportFilters", () => {
  it("keeps a known request status and trims the document type", () => {
    const filters = parseReportFilters("  Form 137  ", "ready_for_pickup");
    assert.equal(filters.documentType, "Form 137");
    assert.equal(filters.status, "ready_for_pickup");
  });

  it("ignores blank values and unknown statuses so stale links stay safe", () => {
    const filters = parseReportFilters("   ", "not_a_status");
    assert.equal(filters.documentType, undefined);
    assert.equal(filters.status, undefined);
  });

  it("validates grade levels and preserves supported grades", () => {
    assert.deepEqual(parseReportFilters("Good Moral Certificate", "pending", "11"), {
      documentType: "Good Moral Certificate", status: "pending", gradeLevel: "11",
    });
    assert.equal(parseReportFilters(undefined, undefined, "99").gradeLevel, undefined);
  });
});

describe("report date formatting", () => {
  it("renders an ISO day as a human-readable date", () => {
    assert.equal(formatReportDate("2026-11-11"), "November 11 2026");
    assert.equal(formatReportDate("2026-01-05"), "January 05 2026");
  });

  it("passes unparseable values through untouched", () => {
    assert.equal(formatReportDate("not-a-date"), "not-a-date");
    assert.equal(formatReportDate(""), "");
  });

  it("formats timestamps with the full date and Manila time", () => {
    assert.equal(formatReportDateTime(new Date("2026-10-31T16:30:00.000Z")), "November 01 2026 12:30 AM");
  });

  it("humanizes the coverage period label", () => {
    const range = parseReportRange("2026-11-01", "2026-11-17");
    assert.equal(formatPeriodLabel(range), "November 01 2026 to November 17 2026");
    assert.equal(formatPeriodLabel({}), "All time");
  });
});

describe("report row filters (integration, local DB)", {
  skip: hasDb ? false : "DATABASE_URL not configured",
}, () => {
  let typeName = "";
  let typeId = "";
  const requestIds: string[] = [];
  let certificateId = "";

  async function seed() {
    fixtureIndex += 1;
    const db = getDb();
    typeName = `Reports Filter Type ${Date.now()}-${fixtureIndex}`;
    const [docType] = await db
      .insert(documentTypes)
      .values({
        name: typeName,
        description: "Fixture for report filter tests",
        requirements: [],
        processingDays: 1,
        fee: "0.00",
        isActive: true,
      })
      .returning();
    typeId = docType.id;

    const statuses = ["pending", "approved", "claimed"] as const;
    for (const [index, status] of statuses.entries()) {
      const [row] = await db
        .insert(documentRequests)
        .values({
          trackingNumber: `RPT-${Date.now()}-${fixtureIndex}-${index}`,
          purpose: "Report filter fixture",
          documentTypeId: typeId,
          status,
          claimedAt: status === "claimed" ? new Date() : null,
        })
        .returning();
      requestIds.push(row.id);
    }

    const [certificate] = await db
      .insert(certificates)
      .values({
        certificateNumber: `RPT-CERT-${Date.now()}-${fixtureIndex}`,
        certificateType: typeName,
        verificationCode: `RPTVERIFY${Date.now()}${fixtureIndex}`,
        qrCodeData: "test",
      })
      .returning();
    certificateId = certificate.id;
  }

  async function cleanup() {
    const db = getDb();
    if (certificateId) await db.delete(certificates).where(eq(certificates.id, certificateId));
    if (requestIds.length) await db.delete(documentRequests).where(inArray(documentRequests.id, requestIds));
    if (typeId) await db.delete(documentTypes).where(eq(documentTypes.id, typeId));
    certificateId = "";
    requestIds.length = 0;
    typeId = "";
  }

  it("scopes the request summary by document type and status", async () => {
    await seed();
    try {
      const byType = await getReportData("request-summary", {}, { documentType: typeName });
      assert.equal(byType.total, 3);

      const pending = await getReportData("request-summary", {}, {
        documentType: typeName,
        status: "pending",
      });
      assert.equal(pending.total, 1);
      assert.equal(pending.rows[0]?.[4], "Pending");

      const approved = await getReportData("request-summary", {}, {
        documentType: typeName,
        status: "approved",
      });
      assert.equal(approved.total, 1);
      assert.equal(approved.rows[0]?.[4], "Approved");
    } finally {
      await cleanup();
    }
  });

  it("filters request summary rows by grade level", async () => {
    await seed();
    try {
      await getDb().update(documentRequests).set({ gradeLevelNeeded: "7" }).where(inArray(documentRequests.id, requestIds));
      const report = await getReportData("request-summary", {}, { gradeLevel: "7" });
      assert.ok(report.rows.length >= 3);
      assert.ok(report.rows.every((row) => row[3] === "7"));
    } finally {
      await cleanup();
    }
  });

  it("scopes claimed documents by document type and status", async () => {
    await seed();
    try {
      const claimed = await getReportData("claimed-documents", {}, { documentType: typeName });
      assert.equal(claimed.total, 1);

      // Claimed rows can never carry another status: the filters stack.
      const approved = await getReportData("claimed-documents", {}, {
        documentType: typeName,
        status: "approved",
      });
      assert.equal(approved.total, 0);
    } finally {
      await cleanup();
    }
  });

  it("scopes generated certificates by document type", async () => {
    await seed();
    try {
      const filtered = await getReportData("generated-certificates", {}, { documentType: typeName });
      assert.equal(filtered.total, 1);
      assert.equal(filtered.rows[0]?.[1], typeName);
    } finally {
      await cleanup();
    }
  });

  it("merges every report into one PDF whose pages match the sections", async () => {
    await seed();
    try {
      const range = parseReportRange(undefined, undefined);
      const filters = { documentType: typeName };

      const combined = await PDFDocument.load(await renderAllReportsPdf(range, filters));
      let sectionPages = 0;
      for (const key of REPORT_KEYS) {
        const section = await PDFDocument.load(await renderReportPdf(key, range, filters));
        sectionPages += section.getPageCount();
      }

      assert.equal(combined.getPageCount(), sectionPages);
      assert.ok(combined.getPageCount() >= REPORT_KEYS.length);
    } finally {
      await cleanup();
    }
  });
});
