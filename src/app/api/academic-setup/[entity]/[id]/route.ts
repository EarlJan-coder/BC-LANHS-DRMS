import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentDbUser } from "@/lib/auth";
import {
  AcademicSetupError,
  assertAcademicSetupAccess,
  deleteDocumentType,
  deleteGradeLevel,
  deleteSchoolYear,
  deleteSection,
  updateDocumentType,
  updateGradeLevel,
  updateSchoolYear,
  updateSection,
} from "@/lib/services/academic-setup";
import { recordAuditedAction } from "@/lib/services/audit-log";
import {
  documentTypeMutationSchema,
  gradeLevelMutationSchema,
  schoolYearMutationSchema,
  sectionMutationSchema,
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

    if (entity === "document-types") {
      const data = await updateDocumentType(id, documentTypeMutationSchema.parse(body));
      return NextResponse.json({ data });
    }

    throw new AcademicSetupError("Academic setup entity not found.", 404);
  } catch (error) {
    return handleError(error);
  }
}

const auditEntityTypes: Record<string, string> = {
  "school-years": "school_year",
  "grade-levels": "grade_level",
  sections: "section",
  "document-types": "document_type",
};

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  try {
    const role = await assertAcademicSetupAccess();
    const { entity, id } = await params;
    const user = await getCurrentDbUser();

    let data: { name: string };

    if (entity === "school-years") {
      data = await deleteSchoolYear(id);
    } else if (entity === "grade-levels") {
      data = await deleteGradeLevel(id);
    } else if (entity === "sections") {
      data = await deleteSection(id);
    } else if (entity === "document-types") {
      data = await deleteDocumentType(id);
    } else {
      throw new AcademicSetupError("Academic setup entity not found.", 404);
    }

    await recordAuditedAction({
      action: "academic_setup.delete",
      actorRole: role,
      actorUserId: user?.id,
      entityType: auditEntityTypes[entity],
      entityId: id,
      referenceId: id,
      metadata: { name: data.name },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return handleError(error);
  }
}
