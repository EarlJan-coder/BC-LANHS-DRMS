import { and, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import type { z } from "zod";
import { getDb } from "@/db";
import { gradeLevels, schoolYears, sections, subjects } from "@/db/schema";
import { clerkConfigured, getCurrentRole } from "@/lib/auth";
import {
  gradeLevelMutationSchema,
  schoolYearMutationSchema,
  sectionMutationSchema,
  subjectMutationSchema,
} from "@/lib/validators";

export class AcademicSetupError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AcademicSetupError";
    this.status = status;
  }
}

export type AcademicSchoolYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  status: string;
};

export type AcademicGradeLevel = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  sections: number;
  status: string;
};

export type AcademicSubject = {
  id: string;
  code: string;
  name: string;
  gradeLevelId: string | null;
  gradeLevel: string;
  isActive: boolean;
  status: string;
};

export type AcademicSection = {
  id: string;
  name: string;
  gradeLevelId: string | null;
  gradeLevel: string;
  schoolYearId: string | null;
  schoolYear: string;
  adviserName: string;
  isActive: boolean;
  status: string;
};

export type AcademicSetupData = {
  schoolYears: AcademicSchoolYear[];
  gradeLevels: AcademicGradeLevel[];
  sections: AcademicSection[];
  subjects: AcademicSubject[];
};

type SchoolYearMutation = z.infer<typeof schoolYearMutationSchema>;
type GradeLevelMutation = z.infer<typeof gradeLevelMutationSchema>;
type SectionMutation = z.infer<typeof sectionMutationSchema>;
type SubjectMutation = z.infer<typeof subjectMutationSchema>;

function formatDateInput(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function parseOptionalDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new AcademicSetupError("Use a valid school year date.");
  }

  return date;
}

function assertDateOrder(startsOn: Date | null, endsOn: Date | null) {
  if (startsOn && endsOn && endsOn < startsOn) {
    throw new AcademicSetupError("The school year end date must be after the start date.");
  }
}

export async function assertAcademicSetupAccess() {
  const role = await getCurrentRole();

  if (clerkConfigured() && role !== "registrar" && role !== "admin") {
    throw new AcademicSetupError("Registrar access is required.", 403);
  }

  return role;
}

export async function getAcademicSetupData(): Promise<AcademicSetupData> {
  const db = getDb();
  const [schoolYearRows, gradeLevelRows, sectionRows, subjectRows] = await Promise.all([
    db.select().from(schoolYears).orderBy(desc(schoolYears.createdAt)),
    db
      .select({
        id: gradeLevels.id,
        name: gradeLevels.name,
        order: gradeLevels.order,
        isActive: gradeLevels.isActive,
        sections: sql<number>`cast(count(${sections.id}) as int)`,
      })
      .from(gradeLevels)
      .leftJoin(sections, eq(gradeLevels.id, sections.gradeLevelId))
      .groupBy(gradeLevels.id)
      .orderBy(gradeLevels.order, gradeLevels.name),
    db
      .select({
        id: sections.id,
        name: sections.name,
        gradeLevelId: sections.gradeLevelId,
        gradeLevel: gradeLevels.name,
        schoolYearId: sections.schoolYearId,
        schoolYear: schoolYears.name,
        adviserName: sections.adviserName,
        isActive: sections.isActive,
      })
      .from(sections)
      .leftJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .leftJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
      .orderBy(gradeLevels.order, sections.name),
    db
      .select({
        id: subjects.id,
        code: subjects.code,
        name: subjects.name,
        gradeLevelId: subjects.gradeLevelId,
        gradeLevel: gradeLevels.name,
        isActive: subjects.isActive,
      })
      .from(subjects)
      .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
      .orderBy(subjects.code, subjects.name),
  ]);

  return {
    schoolYears: schoolYearRows.map((row) => ({
      id: row.id,
      name: row.name,
      startsOn: formatDateInput(row.startsOn),
      endsOn: formatDateInput(row.endsOn),
      isActive: row.isActive,
      status: row.isActive ? "Active" : "Closed",
    })),
    gradeLevels: gradeLevelRows.map((row) => ({
      id: row.id,
      name: row.name,
      order: row.order,
      isActive: row.isActive,
      sections: Number(row.sections),
      status: row.isActive ? "Active" : "Inactive",
    })),
    sections: sectionRows.map((row) => ({
      id: row.id,
      name: row.name,
      gradeLevelId: row.gradeLevelId,
      gradeLevel: row.gradeLevel ?? "Not assigned",
      schoolYearId: row.schoolYearId,
      schoolYear: row.schoolYear ?? "Any active year",
      adviserName: row.adviserName ?? "",
      isActive: row.isActive,
      status: row.isActive ? "Active" : "Inactive",
    })),
    subjects: subjectRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      gradeLevelId: row.gradeLevelId,
      gradeLevel: row.gradeLevel ?? "Not assigned",
      isActive: row.isActive,
      status: row.isActive ? "Active" : "Inactive",
    })),
  };
}

async function ensureUniqueSchoolYearName(name: string, currentId?: string) {
  const db = getDb();
  const existing = await db.query.schoolYears.findFirst({
    where: eq(schoolYears.name, name),
  });

  if (existing && existing.id !== currentId) {
    throw new AcademicSetupError("A school year with this name already exists.");
  }
}

async function ensureUniqueGradeLevelName(name: string, currentId?: string) {
  const db = getDb();
  const existing = await db.query.gradeLevels.findFirst({
    where: eq(gradeLevels.name, name),
  });

  if (existing && existing.id !== currentId) {
    throw new AcademicSetupError("A grade level with this name already exists.");
  }
}

async function ensureUniqueSubjectCode(code: string, currentId?: string) {
  const db = getDb();
  const existing = await db.query.subjects.findFirst({
    where: eq(subjects.code, code),
  });

  if (existing && existing.id !== currentId) {
    throw new AcademicSetupError("A subject with this code already exists.");
  }
}

async function ensureGradeLevelExists(gradeLevelId?: string) {
  if (!gradeLevelId) {
    return;
  }

  const db = getDb();
  const gradeLevel = await db.query.gradeLevels.findFirst({
    where: eq(gradeLevels.id, gradeLevelId),
  });

  if (!gradeLevel) {
    throw new AcademicSetupError("Select an existing grade level.");
  }
}

async function ensureSchoolYearExists(schoolYearId?: string) {
  if (!schoolYearId) {
    return;
  }

  const db = getDb();
  const schoolYear = await db.query.schoolYears.findFirst({
    where: eq(schoolYears.id, schoolYearId),
  });

  if (!schoolYear) {
    throw new AcademicSetupError("Select an existing school year.");
  }
}

async function ensureUniqueSectionName(
  name: string,
  gradeLevelId: string,
  schoolYearId?: string,
  currentId?: string,
) {
  const db = getDb();
  const existing = await db
    .select({
      id: sections.id,
    })
    .from(sections)
    .where(
      and(
        eq(sections.name, name),
        eq(sections.gradeLevelId, gradeLevelId),
        schoolYearId ? eq(sections.schoolYearId, schoolYearId) : isNull(sections.schoolYearId),
      ),
    )
    .limit(1);

  if (existing[0] && existing[0].id !== currentId) {
    throw new AcademicSetupError("A section with this name already exists for this grade level and school year.");
  }
}

export async function createSchoolYear(values: SchoolYearMutation) {
  const db = getDb();
  const startsOn = parseOptionalDate(values.startsOn);
  const endsOn = parseOptionalDate(values.endsOn);

  assertDateOrder(startsOn, endsOn);
  await ensureUniqueSchoolYearName(values.name);

  if (values.isActive) {
    await db
      .update(schoolYears)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schoolYears.isActive, true));
  }

  const [created] = await db
    .insert(schoolYears)
    .values({
      name: values.name,
      startsOn,
      endsOn,
      isActive: values.isActive,
    })
    .returning();

  return created;
}

export async function updateSchoolYear(id: string, values: SchoolYearMutation) {
  const db = getDb();
  const startsOn = parseOptionalDate(values.startsOn);
  const endsOn = parseOptionalDate(values.endsOn);

  assertDateOrder(startsOn, endsOn);
  await ensureUniqueSchoolYearName(values.name, id);

  if (values.isActive) {
    await db
      .update(schoolYears)
      .set({ isActive: false, updatedAt: new Date() })
      .where(ne(schoolYears.id, id));
  }

  const [updated] = await db
    .update(schoolYears)
    .set({
      name: values.name,
      startsOn,
      endsOn,
      isActive: values.isActive,
      updatedAt: new Date(),
    })
    .where(eq(schoolYears.id, id))
    .returning();

  if (!updated) {
    throw new AcademicSetupError("School year not found.", 404);
  }

  return updated;
}

export async function createGradeLevel(values: GradeLevelMutation) {
  const db = getDb();
  await ensureUniqueGradeLevelName(values.name);

  const [created] = await db
    .insert(gradeLevels)
    .values({
      name: values.name,
      order: values.order,
      isActive: values.isActive,
    })
    .returning();

  return created;
}

export async function updateGradeLevel(id: string, values: GradeLevelMutation) {
  const db = getDb();
  await ensureUniqueGradeLevelName(values.name, id);

  const [updated] = await db
    .update(gradeLevels)
    .set({
      name: values.name,
      order: values.order,
      isActive: values.isActive,
      updatedAt: new Date(),
    })
    .where(eq(gradeLevels.id, id))
    .returning();

  if (!updated) {
    throw new AcademicSetupError("Grade level not found.", 404);
  }

  return updated;
}

export async function createSection(values: SectionMutation) {
  const db = getDb();
  const schoolYearId = values.schoolYearId || undefined;

  await Promise.all([
    ensureGradeLevelExists(values.gradeLevelId),
    ensureSchoolYearExists(schoolYearId),
    ensureUniqueSectionName(values.name, values.gradeLevelId, schoolYearId),
  ]);

  const [created] = await db
    .insert(sections)
    .values({
      name: values.name,
      gradeLevelId: values.gradeLevelId,
      schoolYearId,
      adviserName: values.adviserName || undefined,
      isActive: values.isActive,
    })
    .returning();

  return created;
}

export async function updateSection(id: string, values: SectionMutation) {
  const db = getDb();
  const schoolYearId = values.schoolYearId || undefined;

  await Promise.all([
    ensureGradeLevelExists(values.gradeLevelId),
    ensureSchoolYearExists(schoolYearId),
    ensureUniqueSectionName(values.name, values.gradeLevelId, schoolYearId, id),
  ]);

  const [updated] = await db
    .update(sections)
    .set({
      name: values.name,
      gradeLevelId: values.gradeLevelId,
      schoolYearId: schoolYearId ?? null,
      adviserName: values.adviserName || null,
      isActive: values.isActive,
      updatedAt: new Date(),
    })
    .where(eq(sections.id, id))
    .returning();

  if (!updated) {
    throw new AcademicSetupError("Section not found.", 404);
  }

  return updated;
}

export async function createSubject(values: SubjectMutation) {
  const db = getDb();
  const gradeLevelId = values.gradeLevelId || undefined;

  await Promise.all([ensureUniqueSubjectCode(values.code), ensureGradeLevelExists(gradeLevelId)]);

  const [created] = await db
    .insert(subjects)
    .values({
      code: values.code,
      name: values.name,
      gradeLevelId,
      isActive: values.isActive,
    })
    .returning();

  return created;
}

export async function updateSubject(id: string, values: SubjectMutation) {
  const db = getDb();
  const gradeLevelId = values.gradeLevelId || undefined;

  await Promise.all([ensureUniqueSubjectCode(values.code, id), ensureGradeLevelExists(gradeLevelId)]);

  const [updated] = await db
    .update(subjects)
    .set({
      code: values.code,
      name: values.name,
      gradeLevelId: gradeLevelId ?? null,
      isActive: values.isActive,
      updatedAt: new Date(),
    })
    .where(eq(subjects.id, id))
    .returning();

  if (!updated) {
    throw new AcademicSetupError("Subject not found.", 404);
  }

  return updated;
}

export async function getAcademicSetupCounts() {
  const db = getDb();
  const [schoolYearCount, gradeLevelCount, sectionCount, subjectCount] = await Promise.all([
    db.select({ value: count() }).from(schoolYears),
    db.select({ value: count() }).from(gradeLevels),
    db.select({ value: count() }).from(sections),
    db.select({ value: count() }).from(subjects),
  ]);

  return {
    schoolYears: Number(schoolYearCount[0]?.value ?? 0),
    gradeLevels: Number(gradeLevelCount[0]?.value ?? 0),
    sections: Number(sectionCount[0]?.value ?? 0),
    subjects: Number(subjectCount[0]?.value ?? 0),
  };
}
