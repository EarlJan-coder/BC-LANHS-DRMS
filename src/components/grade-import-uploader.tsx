"use client";

import { CheckCircle2, Download, UploadCloud, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GradeImportValidation } from "@/lib/types";

export function GradeImportUploader() {
  const [validation, setValidation] = useState<GradeImportValidation | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  async function validate(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name) {
      toast.error("Select an Excel or CSV file first.");
      return;
    }

    setLoading(true);
    setFileName(file.name);

    const response = await fetch("/api/grade-import/validate", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to validate file.");
      return;
    }

    setValidation(data);
    toast.success("Grade import file validated.");
  }

  async function commit() {
    if (!validation || validation.validRows.length === 0) {
      toast.error("No valid rows to save.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/grade-import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, rows: validation.validRows }),
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Unable to save grade records.");
      return;
    }

    toast.success(`Saved ${data.savedRows} grade row(s).`);
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Bulk grade import</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={validate} className="grid gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-rose-200 bg-rose-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <input
                name="file"
                type="file"
                accept=".csv,.xls,.xlsx"
                className="text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
              />
              <div className="flex flex-wrap gap-2">
                <ButtonLink href="/api/grade-import/template" tone="secondary">
                  <Download className="h-4 w-4" aria-hidden />
                  XLSX template
                </ButtonLink>
                <Button type="submit" disabled={loading}>
                  <UploadCloud className="h-4 w-4" aria-hidden />
                  {loading ? "Validating" : "Validate"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {validation ? (
        <Card>
          <CardHeader>
            <CardTitle>Validation result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-slate-500">Total rows</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{validation.totalRows}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Valid rows
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{validation.validRows.length}</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-red-700">
                  <XCircle className="h-4 w-4" />
                  Errors
                </p>
                <p className="mt-2 text-2xl font-semibold text-red-800">{validation.errors.length}</p>
              </div>
            </div>

            {validation.validRows.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">LRN</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Student</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Subject</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Final</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {validation.validRows.slice(0, 8).map((row, index) => (
                      <tr key={`${row.lrn}-${row.subjectCode}-${index}`}>
                        <td className="px-4 py-3">{row.lrn}</td>
                        <td className="px-4 py-3">
                          {[row.firstName, row.lastName].filter(Boolean).join(" ") || "Matched student"}
                        </td>
                        <td className="px-4 py-3">{row.subjectCode || row.subjectName}</td>
                        <td className="px-4 py-3">{row.finalGrade ?? "Not set"}</td>
                        <td className="px-4 py-3">{row.remarks || "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {validation.errors.length > 0 ? (
              <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Row</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Field</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {validation.errors.map((error, index) => (
                      <tr key={`${error.rowNumber}-${error.fieldName}-${index}`}>
                        <td className="px-4 py-3">{error.rowNumber}</td>
                        <td className="px-4 py-3">{error.fieldName}</td>
                        <td className="px-4 py-3">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end">
              <Button type="button" onClick={commit} disabled={loading || validation.validRows.length === 0}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Save valid rows
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
