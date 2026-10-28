"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { StudentImportValidation } from "@/lib/services/student-import";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function StudentImportUploader() {
  const router = useRouter();
  const [validation, setValidation] = useState<StudentImportValidation | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState<"validate" | "commit" | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleValidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || !file.name) {
      toast.error("Choose a CSV or Excel file first.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Student import files must be 5 MB or smaller.");
      return;
    }

    setLoading("validate");
    setValidation(null);
    setImportedCount(null);
    setFileName(file.name);

    try {
      const response = await fetch("/api/students/import/validate", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Unable to validate the student file.");
        return;
      }

      setValidation(data as StudentImportValidation);
      if ((data as StudentImportValidation).errors.length === 0) {
        toast.success("Every student row is ready to import.");
      } else {
        toast.error("Review the spreadsheet errors before importing.");
      }
    } catch {
      toast.error("Unable to validate the file. Check your connection and try again.");
    } finally {
      setLoading(null);
    }
  }

  function requestCommit() {
    if (!validation || validation.validRows.length === 0 || validation.errors.length > 0) {
      toast.error("Fix every row error before importing the batch.");
      return;
    }

    setConfirmOpen(true);
  }

  async function commit() {
    const rows = validation?.validRows;
    if (!rows || rows.length === 0) {
      return;
    }

    setLoading("commit");
    try {
      const response = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, fileName }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.validation) {
          setValidation(data.validation as StudentImportValidation);
        }
        toast.error(data.error ?? "Unable to import student records.");
        return;
      }

      setImportedCount(Number(data.importedCount ?? 0));
      setValidation(null);
      toast.success(`Imported ${data.importedCount} student record(s).`);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Unable to import students. Check your connection and try again.");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;
  const canImport = Boolean(validation && validation.validRows.length > 0 && validation.errors.length === 0);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand" aria-hidden />
            Upload student spreadsheet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleValidate} className="grid gap-4">
            <div className="grid gap-4 rounded-lg border border-dashed border-rose-200 bg-rose-50/50 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-2">
                <label htmlFor="student-import-file" className="text-sm font-medium text-slate-800">
                  CSV or Excel file
                </label>
                <input
                  id="student-import-file"
                  name="file"
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  required
                  onChange={() => {
                    setValidation(null);
                    setImportedCount(null);
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:transition hover:file:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <p className="text-xs text-slate-500">Maximum 5 MB and 500 student rows per import.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/api/students/import/template" tone="secondary">
                  <Download className="h-4 w-4" aria-hidden />
                  Download template
                </ButtonLink>
                <Button type="submit" loading={loading === "validate"} disabled={busy}>
                  {loading === "validate" ? null : <UploadCloud className="h-4 w-4" aria-hidden />}
                  {loading === "validate" ? "Checking…" : "Validate file"}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
              <p><span className="font-medium text-slate-800">Required:</span> LRN, first name, and last name.</p>
              <p><span className="font-medium text-slate-800">Academic placement:</span> grade, section, and school year are optional.</p>
              <p><span className="font-medium text-slate-800">Allowed student type:</span> current, alumni, or transferee.</p>
              <p><span className="font-medium text-slate-800">Allowed status:</span> enrolled, alumni, transferred, or inactive.</p>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Every row must pass validation before anything is saved. Existing or repeated LRNs are rejected. Keep LRN cells as text so leading zeros are preserved.
            </p>
          </form>
        </CardContent>
      </Card>

      {importedCount !== null ? (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          Imported {importedCount} student record(s). The student list has been refreshed.
        </div>
      ) : null}

      {loading ? (
        <p role="status" aria-live="polite" className="text-sm text-slate-500">
          {loading === "validate" ? "Checking student and academic records…" : "Saving the student batch…"}
        </p>
      ) : null}

      {validation ? (
        <Card>
          <CardHeader>
            <CardTitle>Review import</CardTitle>
            <p className="mt-1 text-sm text-slate-500">{fileName || "Selected file"}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Spreadsheet rows" value={validation.totalRows} />
              <Metric label="Ready to import" value={validation.validRows.length} tone="success" />
              <Metric label="Issues to fix" value={validation.errors.length} tone={validation.errors.length ? "danger" : "neutral"} />
            </div>

            {validation.errors.length > 0 ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Fix these rows in the spreadsheet, then upload it again.
                </p>
                <div className="mt-3 overflow-x-auto rounded-md border border-amber-200 bg-white">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-600">Row</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-600">Field</th>
                        <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-600">Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validation.errors.slice(0, 50).map((error, index) => (
                        <tr key={`${error.rowNumber}-${error.fieldName}-${index}`}>
                          <td className="whitespace-nowrap px-3 py-2">{error.rowNumber || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2">{error.fieldName}</td>
                          <td className="px-3 py-2">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {validation.errors.length > 50 ? (
                  <p className="mt-2 text-xs">Showing 50 of {validation.errors.length} issues.</p>
                ) : null}
                <p className="mt-3 text-xs">This batch is all-or-nothing; no rows will be saved while errors remain.</p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">LRN</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Student</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Placement</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {validation.validRows.slice(0, 8).map((row, index) => (
                      <tr key={`${row.lrn}-${index}`}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.lrn}</td>
                        <td className="px-4 py-3">{[row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" ")}</td>
                        <td className="px-4 py-3">{[row.gradeLevel, row.section, row.schoolYear].filter(Boolean).join(" · ") || "Unassigned"}</td>
                        <td className="px-4 py-3 capitalize">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validation.validRows.length > 8 ? (
                  <p className="border-t border-border px-4 py-2 text-xs text-slate-500">Showing 8 of {validation.validRows.length} valid rows.</p>
                ) : null}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">No accounts or passwords are created by this import. Students can sign up after their record is added.</p>
              <Button type="button" onClick={requestCommit} loading={loading === "commit"} disabled={busy || !canImport}>
                {loading === "commit" ? null : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                {loading === "commit" ? "Importing…" : `Import ${validation.validRows.length} students`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Import these students?"
        message={`Add ${validation?.validRows.length ?? 0} student record(s) from ${fileName}. The batch will be saved together.`}
        confirmLabel="Import students"
        loading={loading === "commit"}
        onConfirm={commit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "danger" }) {
  const classes = {
    neutral: "border-border bg-white text-slate-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div className={`rounded-lg border p-4 ${classes[tone]}`}>
      <p className="text-sm opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
