import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AcademicSetupError,
  assertAcademicSetupAccess,
  createGradeLevel,
  createSchoolYear,
  createSection,
  createSubject,
  getAcademicSetupData,
} from "@/lib/services/academic-setup";
import {
  gradeLevelMutationSchema,
  schoolYearMutationSchema,
  sectionMutationSchema,
  subjectMutationSchema,
} from "@/lib/validators";

function handleError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid academic setup data." }, { status: 400 });
  }

  if (error instanceof AcademicSetupError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to save academic setup." },
    { status: 500 },
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    await assertAcademicSetupAccess();
    const { entity } = await params;
    const data = await getAcademicSetupData();

    if (entity === "school-years") {
      return NextResponse.json({ data: data.schoolYears });
    }

    if (entity === "grade-levels") {
      return NextResponse.json({ data: data.gradeLevels });
    }

    if (entity === "sections") {
      return NextResponse.json({ data: data.sections });
    }

    if (entity === "subjects") {
      return NextResponse.json({ data: data.subjects });
    }

    throw new AcademicSetupError("Academic setup entity not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    await assertAcademicSetupAccess();
    const { entity } = await params;
    const body = await request.json();

    if (entity === "school-years") {
      const data = await createSchoolYear(schoolYearMutationSchema.parse(body));
      return NextResponse.json({ data }, { status: 201 });
    }

    if (entity === "grade-levels") {
      const data = await createGradeLevel(gradeLevelMutationSchema.parse(body));
      return NextResponse.json({ data }, { status: 201 });
    }

    if (entity === "sections") {
      const data = await createSection(sectionMutationSchema.parse(body));
      return NextResponse.json({ data }, { status: 201 });
    }

    if (entity === "subjects") {
      const data = await createSubject(subjectMutationSchema.parse(body));
      return NextResponse.json({ data }, { status: 201 });
    }

    throw new AcademicSetupError("Academic setup entity not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}
