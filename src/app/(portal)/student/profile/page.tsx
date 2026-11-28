import { ProfileUpdateForm } from "@/components/profile-update-form";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStudentProfile } from "@/lib/services/live-data";
import { formatDate } from "@/lib/utils";

export default async function StudentProfilePage() {
  const profile = await getCurrentStudentProfile();

  return (
    <div>
      <SectionHeading title="Profile" description="Student information used for registrar validation." />

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Student profile</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{profile.name}</h2>
            {profile.hasStudentRecord ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="font-mono">LRN {profile.lrn}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-slate-500">No student profile linked</p>
            )}
          </div>
          <ProfileUpdateForm
            firstName={profile.firstName}
            middleName={profile.middleName}
            lastName={profile.lastName}
            suffix={profile.suffix}
            birthDate={profile.birthDate}
            gender={profile.gender}
            email={profile.email}
            contactNumber={profile.contactNumber}
            address={profile.address}
            lastSchoolYearAttended={profile.lastSchoolYearAttended}
            hasStudentRecord={profile.hasStudentRecord}
          />
        </div>
      </div>

      {/* Grouped detail cards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Personal details</CardTitle>
              <span className="ml-auto text-xs font-medium text-slate-500">Editable</span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="First name" value={profile.firstName} />
              <Field label="Middle name" value={profile.middleName || "Not set"} />
              <Field label="Last name" value={profile.lastName} />
              <Field label="Suffix" value={profile.suffix || "Not set"} />
              <Field label="Birth date" value={profile.birthDate ? formatDate(new Date(`${profile.birthDate}T00:00:00.000Z`)) : "Not set"} />
              <Field label="Gender" value={profile.gender || "Not set"} />
            </dl>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Contact</CardTitle>
              <span className="ml-auto text-xs font-medium text-slate-500">Editable</span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact number" value={profile.contactNumber} />
              <Field label="Email" value={profile.email} />
            </dl>
            {profile.hasStudentRecord ? null : (
              <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-brand-dark">
                Contact the registrar to link your student record before updating your contact number.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic record</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.hasStudentRecord ? (
              <dl className="grid gap-4 sm:grid-cols-1">
                <Field label="LRN" value={profile.lrn || "Not set"} />
                <Field label="Last school year attended" value={profile.lastSchoolYearAttended} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No student profile linked.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle>Address</CardTitle>
              <span className="ml-auto text-xs font-medium text-slate-500">Editable</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold text-slate-900">{profile.address}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
