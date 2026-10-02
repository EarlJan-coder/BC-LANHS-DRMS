import { AcademicSetupManager } from "@/components/academic-setup-manager";
import { SectionHeading } from "@/components/section-heading";
import { assertAcademicSetupAccess, getAcademicSetupData } from "@/lib/services/academic-setup";

export default async function AdminAcademicSetupPage() {
  await assertAcademicSetupAccess();
  const data = await getAcademicSetupData();

  return (
    <div>
      <SectionHeading
        title="Academic setup"
        description="Maintain the school years, grade levels, sections, subjects, and document types used for student records and grade imports."
      />
      <AcademicSetupManager data={data} />
    </div>
  );
}