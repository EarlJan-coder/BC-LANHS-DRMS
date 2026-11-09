import { GraduationCap, MapPin, Phone } from "lucide-react";
import { ProfileUpdateForm } from "@/components/profile-update-form";
import { SectionHeading } from "@/components/section-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentStudentProfile } from "@/lib/services/live-data";

export default async function StudentProfilePage() {
  const profile = await getCurrentStudentProfile();

  return (
    <div>
      <SectionHeading title="Profile" description="Student information used for registrar validation." />

      {/* Identity banner */}
      <div className="overflow-hidden rounded-lg bg-gradient-to-br from-brand to-brand-dark">
        <div className="flex flex-wrap items-center gap-4 px-6 py-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold text-white">{profile.name}</h2>
            {profile.hasStudentRecord ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-rose-100">
                <span className="font-mono">LRN {profile.lrn}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-rose-100">No student profile linked</p>
            )}
          </div>
          <ProfileUpdateForm
            email={profile.email}
            contactNumber={profile.contactNumber}
            hasStudentRecord={profile.hasStudentRecord}
            triggerClassName="border-transparent bg-white text-brand hover:bg-rose-50"
          />
        </div>
      </div>

      {/* Grouped detail cards */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="border-rose-200 lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <SectionIcon tone="brand">
                <Phone className="h-4 w-4" aria-hidden />
              </SectionIcon>
              <CardTitle>Contact</CardTitle>
              <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
                Editable
              </span>
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
            <div className="flex items-center gap-3">
              <SectionIcon>
                <GraduationCap className="h-4 w-4" aria-hidden />
              </SectionIcon>
              <CardTitle>Academic record</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {profile.hasStudentRecord ? (
              <dl className="grid gap-4 sm:grid-cols-1">
                <Field label="LRN" value={profile.lrn} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No student profile linked.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <SectionIcon>
                <MapPin className="h-4 w-4" aria-hidden />
              </SectionIcon>
              <CardTitle>Address</CardTitle>
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

function SectionIcon({ tone = "muted", children }: { tone?: "brand" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
        tone === "brand" ? "bg-brand-soft text-brand" : "bg-slate-100 text-slate-600"
      }`}
    >
      {children}
    </span>
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
