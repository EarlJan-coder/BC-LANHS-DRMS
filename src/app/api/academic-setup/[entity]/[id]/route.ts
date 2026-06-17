import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AcademicSetupError,
  assertAcademicSetupAccess,
  updateGradeLevel,
  updateSchoolYear,
  updateSection,
  updateSubject,
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
    { error: error instanceof Error ? error.message : "Unable to update academic setup." },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  try {
    await assertAcademicSetupAccess();
    const { entity, id } = await params;
    const body = await request.json();

    if (entity === "school-years") {
      const data = await updateSchoolYear(id, schoolYearMutationSchema.parse(body));
      return NextResponse.json({ data });
    }

    if (entity === "grade-levels") {
      const data = await updateGradeLevel(id, gradeLevelMutationSchema.parse(body));
      return NextResponse.json({ data });
    }

    if (entity === "sections") {
      const data = await updateSection(id, sectionMutationSchema.parse(body));
      return NextResponse.json({ data });
    }

    if (entity === "subjects") {
      const data = await updateSubject(id, subjectMutationSchema.parse(body));
      return NextResponse.json({ data });
    }

    throw new AcademicSetupError("Academic setup entity not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}
