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
        code: `RPT_${Date.now()}_${fixtureIndex}`,
        description: "Fixture for report filter tests",
        requirements: [],
        processingDays: 1,
        fee: 0,
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
      assert.equal(pending.rows[0]?.[3], "Pending");

      const approved = await getReportData("request-summary", {}, {
        documentType: typeName,
        status: "approved",
      });
      assert.equal(approved.total, 1);
      assert.equal(approved.rows[0]?.[3], "Approved");
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
