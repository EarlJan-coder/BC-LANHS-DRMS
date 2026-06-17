"use client";

import { BookOpen, CalendarDays, CheckCircle2, Layers3, PanelsTopLeft, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type RefObject, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import type { AcademicSetupData } from "@/lib/services/academic-setup";
import { cn } from "@/lib/utils";

type Entity = "school-years" | "grade-levels" | "sections" | "subjects";
type Panel = Entity;

const panelOptions: Array<{
  value: Panel;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { value: "school-years", label: "School years", icon: CalendarDays },
  { value: "grade-levels", label: "Grade levels", icon: Layers3 },
  { value: "sections", label: "Sections", icon: PanelsTopLeft },
  { value: "subjects", label: "Subjects", icon: BookOpen },
];

function textValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function schoolYearPayload(formData: FormData) {
  return {
    name: textValue(formData, "name"),
    startsOn: textValue(formData, "startsOn"),
    endsOn: textValue(formData, "endsOn"),
    isActive: checkboxValue(formData, "isActive"),
  };
}

function gradeLevelPayload(formData: FormData) {
  return {
    name: textValue(formData, "name"),
    order: textValue(formData, "order"),
    isActive: checkboxValue(formData, "isActive"),
  };
}

function subjectPayload(formData: FormData) {
  return {
    code: textValue(formData, "code"),
    name: textValue(formData, "name"),
    gradeLevelId: textValue(formData, "gradeLevelId"),
    isActive: checkboxValue(formData, "isActive"),
  };
}

function sectionPayload(formData: FormData) {
  return {
    name: textValue(formData, "name"),
    gradeLevelId: textValue(formData, "gradeLevelId"),
    schoolYearId: textValue(formData, "schoolYearId"),
    adviserName: textValue(formData, "adviserName"),
    isActive: checkboxValue(formData, "isActive"),
  };
}

export function AcademicSetupManager({ data }: { data: AcademicSetupData }) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<Panel>("school-years");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const schoolYearFormRef = useRef<HTMLFormElement>(null);
  const gradeLevelFormRef = useRef<HTMLFormElement>(null);
  const sectionFormRef = useRef<HTMLFormElement>(null);
  const subjectFormRef = useRef<HTMLFormElement>(null);

  async function save({
    entity,
    id,
    payload,
    success,
    resetRef,
  }: {
    entity: Entity;
    id?: string;
    payload: Record<string, string | boolean>;
    success: string;
    resetRef?: RefObject<HTMLFormElement | null>;
  }) {
    const key = id ? `${entity}-${id}` : `${entity}-new`;
    setSubmitting(key);

    try {
      const response = await fetch(`/api/academic-setup/${entity}${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseData = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(responseData.error ?? "Unable to save academic setup.");
      }

      toast.success(success);
      resetRef?.current?.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save academic setup.");
    } finally {
      setSubmitting(null);
    }
  }

  const isSubmitting = Boolean(submitting);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 md:grid-cols-4">
        {panelOptions.map((option) => {
          const Icon = option.icon;
          const active = activePanel === option.value;
          const count =
            option.value === "school-years"
              ? data.schoolYears.length
              : option.value === "grade-levels"
                ? data.gradeLevels.length
                : option.value === "sections"
                  ? data.sections.length
                  : data.subjects.length;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setActivePanel(option.value)}
              className={cn(
                "flex min-h-24 items-center justify-between rounded-lg border px-4 py-3 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50",
              )}
            >
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" aria-hidden />
                  {option.label}
                </span>
                <span className={cn("mt-2 block text-3xl font-semibold", active ? "text-white" : "text-slate-950")}>
                  {count}
                </span>
              </span>
              <CheckCircle2 className={cn("h-5 w-5", active ? "text-white" : "text-slate-300")} aria-hidden />
            </button>
          );
        })}
      </div>

      {activePanel === "school-years" ? (
        <SchoolYearsPanel
          rows={data.schoolYears}
          formRef={schoolYearFormRef}
          isSubmitting={isSubmitting}
          save={save}
        />
      ) : null}

      {activePanel === "grade-levels" ? (
        <GradeLevelsPanel
          rows={data.gradeLevels}
          formRef={gradeLevelFormRef}
          isSubmitting={isSubmitting}
          save={save}
        />
      ) : null}

      {activePanel === "subjects" ? (
        <SubjectsPanel
          rows={data.subjects}
          gradeLevels={data.gradeLevels}
          formRef={subjectFormRef}
          isSubmitting={isSubmitting}
          save={save}
        />
      ) : null}

      {activePanel === "sections" ? (
        <SectionsPanel
          rows={data.sections}
          gradeLevels={data.gradeLevels}
          schoolYears={data.schoolYears}
          formRef={sectionFormRef}
          isSubmitting={isSubmitting}
          save={save}
        />
      ) : null}
    </div>
  );
}

function SchoolYearsPanel({
  rows,
  formRef,
  isSubmitting,
  save,
}: {
  rows: AcademicSetupData["schoolYears"];
  formRef: RefObject<HTMLFormElement | null>;
  isSubmitting: boolean;
  save: (input: {
    entity: Entity;
    id?: string;
    payload: Record<string, string | boolean>;
    success: string;
    resetRef?: RefObject<HTMLFormElement | null>;
  }) => Promise<void>;
}) {
  return (
    <PanelLayout
      title="School years"
      form={
        <form
          ref={formRef}
          action={(formData) =>
            save({
              entity: "school-years",
              payload: schoolYearPayload(formData),
              success: "School year added.",
              resetRef: formRef,
            })
          }
          className="grid gap-4"
        >
          <Field id="new-school-year-name" label="School year" name="name" placeholder="2026-2027" required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="new-school-year-starts-on" label="Start date" name="startsOn" type="date" />
            <Field id="new-school-year-ends-on" label="End date" name="endsOn" type="date" />
          </div>
          <CheckboxField id="new-school-year-active" name="isActive" label="Set as active" defaultChecked={rows.length === 0} />
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" aria-hidden />
            Add school year
          </Button>
        </form>
      }
      rows={
        rows.length === 0 ? (
          <EmptyRows message="No school years configured yet." />
        ) : (
          rows.map((row) => (
            <form
              key={row.id}
              action={(formData) =>
                save({
                  entity: "school-years",
                  id: row.id,
                  payload: schoolYearPayload(formData),
                  success: "School year updated.",
                })
              }
              className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_150px_150px_120px_auto] lg:items-end"
            >
              <Field id={`school-year-name-${row.id}`} label="School year" name="name" defaultValue={row.name} required />
              <Field id={`school-year-starts-on-${row.id}`} label="Start" name="startsOn" type="date" defaultValue={row.startsOn} />
              <Field id={`school-year-ends-on-${row.id}`} label="End" name="endsOn" type="date" defaultValue={row.endsOn} />
              <div className="grid gap-3">
                <StatusPill active={row.isActive} activeLabel="Active" inactiveLabel="Closed" />
                <CheckboxField id={`school-year-active-${row.id}`} name="isActive" label="Active" defaultChecked={row.isActive} />
              </div>
              <Button type="submit" tone="secondary" disabled={isSubmitting}>
                <Save className="h-4 w-4" aria-hidden />
                Save
              </Button>
            </form>
          ))
        )
      }
    />
  );
}

function GradeLevelsPanel({
  rows,
  formRef,
  isSubmitting,
  save,
}: {
  rows: AcademicSetupData["gradeLevels"];
  formRef: RefObject<HTMLFormElement | null>;
  isSubmitting: boolean;
  save: (input: {
    entity: Entity;
    id?: string;
    payload: Record<string, string | boolean>;
    success: string;
    resetRef?: RefObject<HTMLFormElement | null>;
  }) => Promise<void>;
}) {
  return (
    <PanelLayout
      title="Grade levels"
      form={
        <form
          ref={formRef}
          action={(formData) =>
            save({
              entity: "grade-levels",
              payload: gradeLevelPayload(formData),
              success: "Grade level added.",
              resetRef: formRef,
            })
          }
          className="grid gap-4"
        >
          <Field id="new-grade-level-name" label="Grade level" name="name" placeholder="Grade 12" required />
          <Field id="new-grade-level-order" label="Sort order" name="order" type="number" min="0" max="99" defaultValue={String(rows.length + 1)} />
          <CheckboxField id="new-grade-level-active" name="isActive" label="Active" defaultChecked />
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" aria-hidden />
            Add grade level
          </Button>
        </form>
      }
      rows={
        rows.length === 0 ? (
          <EmptyRows message="No grade levels configured yet." />
        ) : (
          rows.map((row) => (
            <form
              key={row.id}
              action={(formData) =>
                save({
                  entity: "grade-levels",
                  id: row.id,
                  payload: gradeLevelPayload(formData),
                  success: "Grade level updated.",
                })
              }
              className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_120px_120px_120px_auto] lg:items-end"
            >
              <Field id={`grade-level-name-${row.id}`} label="Grade level" name="name" defaultValue={row.name} required />
              <Field id={`grade-level-order-${row.id}`} label="Order" name="order" type="number" min="0" max="99" defaultValue={String(row.order)} />
              <div className="grid gap-2">
                <Label>Sections</Label>
                <span className="flex h-10 items-center rounded-md border border-border bg-slate-50 px-3 text-sm text-slate-700">
                  {row.sections}
                </span>
              </div>
              <div className="grid gap-3">
                <StatusPill active={row.isActive} activeLabel="Active" inactiveLabel="Inactive" />
                <CheckboxField id={`grade-level-active-${row.id}`} name="isActive" label="Active" defaultChecked={row.isActive} />
              </div>
              <Button type="submit" tone="secondary" disabled={isSubmitting}>
                <Save className="h-4 w-4" aria-hidden />
                Save
              </Button>
            </form>
          ))
        )
      }
    />
  );
}

function SectionsPanel({
  rows,
  gradeLevels,
  schoolYears,
  formRef,
  isSubmitting,
  save,
}: {
  rows: AcademicSetupData["sections"];
  gradeLevels: AcademicSetupData["gradeLevels"];
  schoolYears: AcademicSetupData["schoolYears"];
  formRef: RefObject<HTMLFormElement | null>;
  isSubmitting: boolean;
  save: (input: {
    entity: Entity;
    id?: string;
    payload: Record<string, string | boolean>;
    success: string;
    resetRef?: RefObject<HTMLFormElement | null>;
  }) => Promise<void>;
}) {
  return (
    <PanelLayout
      title="Sections"
      form={
        <form
          ref={formRef}
          action={(formData) =>
            save({
              entity: "sections",
              payload: sectionPayload(formData),
              success: "Section added.",
              resetRef: formRef,
            })
          }
          className="grid gap-4"
        >
          <Field id="new-section-name" label="Section" name="name" placeholder="STEM - Aguado" required />
          <GradeLevelSelect
            gradeLevels={gradeLevels}
            id="new-section-grade-level"
            emptyLabel="Select grade level"
            required
          />
          <SchoolYearSelect schoolYears={schoolYears} id="new-section-school-year" />
          <Field id="new-section-adviser" label="Adviser" name="adviserName" placeholder="Ms. Elena Garcia" />
          <CheckboxField id="new-section-active" name="isActive" label="Active" defaultChecked />
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" aria-hidden />
            Add section
          </Button>
        </form>
      }
      rows={
        rows.length === 0 ? (
          <EmptyRows message="No sections configured yet." />
        ) : (
          rows.map((row) => (
            <form
              key={row.id}
              action={(formData) =>
                save({
                  entity: "sections",
                  id: row.id,
                  payload: sectionPayload(formData),
                  success: "Section updated.",
                })
              }
              className="grid gap-3 px-5 py-4 2xl:grid-cols-[1.1fr_220px_200px_1fr_120px_auto] 2xl:items-end"
            >
              <Field id={`section-name-${row.id}`} label="Section" name="name" defaultValue={row.name} required />
              <GradeLevelSelect
                gradeLevels={gradeLevels}
                id={`section-grade-level-${row.id}`}
                defaultValue={row.gradeLevelId ?? ""}
                emptyLabel="Select grade level"
                required
              />
              <SchoolYearSelect
                schoolYears={schoolYears}
                id={`section-school-year-${row.id}`}
                defaultValue={row.schoolYearId ?? ""}
              />
              <Field id={`section-adviser-${row.id}`} label="Adviser" name="adviserName" defaultValue={row.adviserName} />
              <div className="grid gap-3">
                <StatusPill active={row.isActive} activeLabel="Active" inactiveLabel="Inactive" />
                <CheckboxField id={`section-active-${row.id}`} name="isActive" label="Active" defaultChecked={row.isActive} />
              </div>
              <Button type="submit" tone="secondary" disabled={isSubmitting}>
                <Save className="h-4 w-4" aria-hidden />
                Save
              </Button>
            </form>
          ))
        )
      }
    />
  );
}

function SubjectsPanel({
  rows,
  gradeLevels,
  formRef,
  isSubmitting,
  save,
}: {
  rows: AcademicSetupData["subjects"];
  gradeLevels: AcademicSetupData["gradeLevels"];
  formRef: RefObject<HTMLFormElement | null>;
  isSubmitting: boolean;
  save: (input: {
    entity: Entity;
    id?: string;
    payload: Record<string, string | boolean>;
    success: string;
    resetRef?: RefObject<HTMLFormElement | null>;
  }) => Promise<void>;
}) {
  return (
    <PanelLayout
      title="Subjects"
      form={
        <form
          ref={formRef}
          action={(formData) =>
            save({
              entity: "subjects",
              payload: subjectPayload(formData),
              success: "Subject added.",
              resetRef: formRef,
            })
          }
          className="grid gap-4"
        >
          <Field id="new-subject-code" label="Subject code" name="code" placeholder="ENG-12" required />
          <Field id="new-subject-name" label="Subject name" name="name" placeholder="English for Academic and Professional Purposes" required />
          <GradeLevelSelect gradeLevels={gradeLevels} id="new-subject-grade-level" />
          <CheckboxField id="new-subject-active" name="isActive" label="Active" defaultChecked />
          <Button type="submit" disabled={isSubmitting}>
            <Plus className="h-4 w-4" aria-hidden />
            Add subject
          </Button>
        </form>
      }
      rows={
        rows.length === 0 ? (
          <EmptyRows message="No subjects configured yet." />
        ) : (
          rows.map((row) => (
            <form
              key={row.id}
              action={(formData) =>
                save({
                  entity: "subjects",
                  id: row.id,
                  payload: subjectPayload(formData),
                  success: "Subject updated.",
                })
              }
              className="grid gap-3 px-5 py-4 xl:grid-cols-[130px_1.4fr_220px_120px_auto] xl:items-end"
            >
              <Field id={`subject-code-${row.id}`} label="Code" name="code" defaultValue={row.code} required />
              <Field id={`subject-name-${row.id}`} label="Subject" name="name" defaultValue={row.name} required />
              <GradeLevelSelect gradeLevels={gradeLevels} id={`subject-grade-level-${row.id}`} defaultValue={row.gradeLevelId ?? ""} />
              <div className="grid gap-3">
                <StatusPill active={row.isActive} activeLabel="Active" inactiveLabel="Inactive" />
                <CheckboxField id={`subject-active-${row.id}`} name="isActive" label="Active" defaultChecked={row.isActive} />
              </div>
              <Button type="submit" tone="secondary" disabled={isSubmitting}>
                <Save className="h-4 w-4" aria-hidden />
                Save
              </Button>
            </form>
          ))
        )
      }
    />
  );
}

function PanelLayout({ title, form, rows }: { title: string; form: React.ReactNode; rows: React.ReactNode }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Add {title.toLowerCase().slice(0, -1)}</CardTitle>
        </CardHeader>
        <CardContent>{form}</CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Manage {title.toLowerCase()}</CardTitle>
        </CardHeader>
        <div className="divide-y divide-border">{rows}</div>
      </Card>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  ...props
}: {
  label: string;
  name: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id ?? name}>{label}</Label>
      <Input id={props.id ?? name} name={name} required={required} {...props} />
    </div>
  );
}

function GradeLevelSelect({
  gradeLevels,
  id,
  defaultValue = "",
  emptyLabel = "Not assigned",
  required = false,
}: {
  gradeLevels: AcademicSetupData["gradeLevels"];
  id: string;
  defaultValue?: string;
  emptyLabel?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Grade level</Label>
      <Select id={id} name="gradeLevelId" defaultValue={defaultValue} required={required}>
        <option value="">{emptyLabel}</option>
        {gradeLevels.map((gradeLevel) => (
          <option key={gradeLevel.id} value={gradeLevel.id}>
            {gradeLevel.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function SchoolYearSelect({
  schoolYears,
  id,
  defaultValue = "",
}: {
  schoolYears: AcademicSetupData["schoolYears"];
  id: string;
  defaultValue?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>School year</Label>
      <Select id={id} name="schoolYearId" defaultValue={defaultValue}>
        <option value="">Any active year</option>
        {schoolYears.map((schoolYear) => (
          <option key={schoolYear.id} value={schoolYear.id}>
            {schoolYear.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function CheckboxField({
  id,
  name,
  label,
  defaultChecked = false,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-slate-700">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
      />
      <span>{label}</span>
    </label>
  );
}

function StatusPill({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-fit items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset",
        active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200",
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

function EmptyRows({ message }: { message: string }) {
  return <div className="px-5 py-10 text-center text-sm text-slate-500">{message}</div>;
}
