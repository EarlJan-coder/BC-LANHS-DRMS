"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDisplayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return formatDate(new Date(`${value}T00:00:00.000Z`), "");
}

function parseDisplayDate(value: string): string | null {
  const match = /^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[1].toLowerCase()) + 1;
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === iso ? iso : null;
}

export function FormattedDateInput({
  id,
  value,
  onChange,
  disabled,
  min,
  max,
  name,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  name?: string;
  label?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => toDisplayDate(value));
  const [invalid, setInvalid] = useState(false);

  function commit(text: string) {
    if (!text.trim()) {
      setInvalid(false);
      onChange("");
      return;
    }
    const parsed = parseDisplayDate(text);
    if (!parsed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(toDisplayDate(parsed));
    onChange(parsed);
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.click();
    }
  }

  return (
    <div className="relative flex items-center gap-1.5">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder="November 01 2026"
        value={draft}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          if (!event.target.value) commit("");
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        className="pr-10"
      />
      <Button
        type="button"
        tone="ghost"
        size="icon"
        aria-label={`Choose ${label ?? "date"}`}
        disabled={disabled}
        onClick={openPicker}
        className="absolute right-1 h-8 w-8 text-slate-500 hover:text-brand"
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
      </Button>
      <input
        ref={pickerRef}
        id={`${id}-picker`}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-0 top-0 h-full w-10 cursor-pointer opacity-0"
        onChange={(event) => {
          setInvalid(false);
          setDraft(toDisplayDate(event.target.value));
          onChange(event.target.value);
        }}
      />
      {invalid ? <p id={`${id}-error`} role="alert" className="absolute left-0 top-full mt-1 text-xs text-red-700">Enter a date like November 01 2026.</p> : null}
    </div>
  );
}
