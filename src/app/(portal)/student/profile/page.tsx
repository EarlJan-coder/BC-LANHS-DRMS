import { ProfileUpdateForm } from "@/components/profile-update-form";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStudentProfile } from "@/lib/services/live-data";

export default async function StudentProfilePage() {
  const profile = await getCurrentStudentProfile();

  return (
    <div>
      <SectionHeading title="Profile" description="Student and alumni information used for registrar validation." />
      <Card>
        <CardHeader>
          <CardTitle>Student profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name" value={profile.name} />
          <Detail label="Email" value={profile.email} />
          <Detail label="LRN" value={profile.lrn} />
          <Detail label="Grade and section" value={profile.gradeAndSection} />
          <Detail label="Contact number" value={profile.contactNumber} />
          <Detail label="Guardian" value={profile.guardian} />
          <Detail label="Address" value={profile.address} />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Update contact information</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileUpdateForm lrn={profile.lrn} contactNumber={profile.contactNumber} guardian={profile.guardian} address={profile.address} />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
