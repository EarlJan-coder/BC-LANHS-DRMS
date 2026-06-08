import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import {
  documentRequests,
  documentTypes,
  gradeLevels,
  gradeImportBatches,
  requestStatusHistory,
  schoolYears,
  sections,
  studentGrades,
  students,
  subjects,
  users,
} from "../src/db/schema";
import { DOCUMENT_TYPES } from "../src/lib/constants";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const { closeDb, getDb } = await import("../src/db");
  const db = getDb();

  try {
    await db.insert(schoolYears).values({ name: "2026-2027", isActive: true }).onConflictDoNothing();

    const levelValues = [
      { name: "Grade 7", order: 7 },
      { name: "Grade 8", order: 8 },
      { name: "Grade 9", order: 9 },
      { name: "Grade 10", order: 10 },
      { name: "Grade 11", order: 11 },
      { name: "Grade 12", order: 12 },
    ];

    await db.insert(gradeLevels).values(levelValues).onConflictDoNothing();

    const grade12 = await db.query.gradeLevels.findFirst({
      where: eq(gradeLevels.name, "Grade 12"),
    });

    if (grade12) {
      await db
        .insert(sections)
        .values([
          { name: "STEM - Aguado", gradeLevelId: grade12.id, adviserName: "Ms. Elena Garcia" },
          { name: "HUMSS - Rizal", gradeLevelId: grade12.id, adviserName: "Mr. Noel Ramos" },
        ])
        .onConflictDoNothing();

      await db
        .insert(subjects)
        .values([
          { code: "ENG-12", name: "English for Academic and Professional Purposes", gradeLevelId: grade12.id },
          { code: "GENMATH-12", name: "General Mathematics", gradeLevelId: grade12.id },
          { code: "FIL-12", name: "Filipino sa Piling Larang", gradeLevelId: grade12.id },
        ])
        .onConflictDoNothing();
    }

    await db
      .insert(documentTypes)
      .values(
        DOCUMENT_TYPES.map((name) => ({
          name,
          code: name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_$/, ""),
          processingDays: name === "Form 137" ? 5 : 3,
          fee: "0",
          isActive: true,
        })),
      )
      .onConflictDoNothing();

    await db
      .insert(users)
      .values([
        {
          clerkId: "seed_admin",
          email: "admin@lanhs.edu.ph",
          firstName: "System",
          lastName: "Administrator",
          role: "admin",
          status: "active",
        },
        {
          clerkId: "seed_registrar",
          email: "registrar@lanhs.edu.ph",
          firstName: "LANHS",
          lastName: "Registrar",
          role: "registrar",
          status: "active",
        },
        {
          clerkId: "seed_student",
          email: "student@lanhs.edu.ph",
          firstName: "Maria",
          lastName: "Santos",
          role: "student",
          status: "active",
        },
        {
          clerkId: "seed_alumni",
          email: "alumni@lanhs.edu.ph",
          firstName: "Juan",
          lastName: "Dela Cruz",
          role: "alumni",
          status: "active",
        },
      ])
      .onConflictDoNothing();

    const schoolYear = await db.query.schoolYears.findFirst({ where: eq(schoolYears.name, "2026-2027") });
    const registrar = await db.query.users.findFirst({ where: eq(users.email, "registrar@lanhs.edu.ph") });
    const studentUser = await db.query.users.findFirst({ where: eq(users.email, "student@lanhs.edu.ph") });
    const certificateType = await db.query.documentTypes.findFirst({ where: eq(documentTypes.name, "Certificate of Grades") });
    const grade12Level = await db.query.gradeLevels.findFirst({ where: eq(gradeLevels.name, "Grade 12") });
    const stemSection = await db.query.sections.findFirst({ where: eq(sections.name, "STEM - Aguado") });

    if (studentUser && grade12Level && stemSection && schoolYear) {
      await db
        .insert(students)
        .values({
          userId: studentUser.id,
          lrn: "123456789012",
          firstName: "Maria",
          middleName: "Reyes",
          lastName: "Santos",
          gender: "Female",
          email: "student@lanhs.edu.ph",
          contactNumber: "09170000001",
          address: "Luis Aguado community",
          guardianName: "Elena Santos",
          guardianContact: "09170000002",
          gradeLevelId: grade12Level.id,
          sectionId: stemSection.id,
          schoolYearId: schoolYear.id,
          studentType: "current",
          status: "enrolled",
          enrollmentStatus: "enrolled",
        })
        .onConflictDoNothing();
    }

    const sampleStudent = await db.query.students.findFirst({ where: eq(students.lrn, "123456789012") });

    if (sampleStudent && studentUser && certificateType) {
      await db
        .insert(documentRequests)
        .values({
          trackingNumber: "LANHS-20260603-A8K2Q",
          studentId: sampleStudent.id,
          requestedByUserId: studentUser.id,
          documentTypeId: certificateType.id,
          purpose: "College scholarship application",
          schoolYearNeeded: "2026-2027",
          gradeLevelNeeded: "Grade 12",
          remarks: "Please include all senior high school subjects.",
          status: "under_review",
          registrarRemarks: "Validated student profile and grade records.",
        })
        .onConflictDoNothing();

      const sampleRequest = await db.query.documentRequests.findFirst({
        where: eq(documentRequests.trackingNumber, "LANHS-20260603-A8K2Q"),
      });
      const hasHistory =
        sampleRequest &&
        (await db.query.requestStatusHistory.findFirst({
          where: eq(requestStatusHistory.requestId, sampleRequest.id),
        }));

      if (sampleRequest && !hasHistory) {
        await db.insert(requestStatusHistory).values([
          {
            requestId: sampleRequest.id,
            newStatus: "pending",
            toStatus: "pending",
            changedBy: studentUser.id,
            actorUserId: studentUser.id,
            remarks: "Request submitted online.",
          },
          {
            requestId: sampleRequest.id,
            oldStatus: "pending",
            newStatus: "under_review",
            fromStatus: "pending",
            toStatus: "under_review",
            changedBy: registrar?.id,
            actorUserId: registrar?.id,
            remarks: "Registrar started validation.",
          },
        ]);
      }
    }

    if (sampleStudent && schoolYear && grade12Level && stemSection && registrar) {
      await db
        .insert(gradeImportBatches)
        .values({
          batchNumber: "BATCH-20260603-DEMO1",
          fileName: "sample-grade-import.xlsx",
          schoolYearId: schoolYear.id,
          importedByUserId: registrar.id,
          uploadedBy: registrar.id,
          totalRows: 3,
          validRows: 3,
          invalidRows: 0,
          importedRows: 3,
          status: "imported",
          blockchainStatus: "pending",
        })
        .onConflictDoNothing();

      const batch = await db.query.gradeImportBatches.findFirst({
        where: eq(gradeImportBatches.batchNumber, "BATCH-20260603-DEMO1"),
      });
      const subjectRows = await db.query.subjects.findMany();

      await db
        .insert(studentGrades)
        .values(
          subjectRows.slice(0, 3).map((subject, index) => ({
            studentId: sampleStudent.id,
            subjectId: subject.id,
            schoolYearId: schoolYear.id,
            gradeLevelId: grade12Level.id,
            sectionId: stemSection.id,
            importBatchId: batch?.id,
            quarter1: String(90 + index),
            quarter2: String(91 + index),
            quarter3: String(92 + index),
            quarter4: String(93 + index),
            finalGrade: String(92 + index),
            remarks: "Passed",
            encodedBy: registrar.id,
          })),
        )
        .onConflictDoNothing();
    }

    console.log("Seed data inserted.");
  } finally {
    await closeDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
