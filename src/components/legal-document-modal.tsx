"use client";

import { useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LegalBlock, LegalDocument, LegalSection } from "@/lib/legal-documents";

// Renders bare URLs in document text as links (e.g. privacy.gov.ph).
function renderText(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function BlockRenderer({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p>{renderText(block.text)}</p>;
    case "clauses":
      return (
        <ol className="space-y-2">
          {block.items.map((item) => (
            <li key={item.id} className="flex gap-2">
              <span className="shrink-0 font-medium text-slate-900">{item.id}</span>
              <span>
                {item.title ? <span className="font-semibold text-slate-900">{item.title} – </span> : null}
                {renderText(item.text)}
              </span>
            </li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">
          {block.items.map((item) => (
            <li key={item}>{renderText(item)}</li>
          ))}
        </ul>
      );
    case "groups":
      return (
        <div className="space-y-4">
          {block.items.map((group) => (
            <div key={group.id}>
              <p className="font-semibold text-slate-900">
                {group.id} {group.label}
              </p>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5 marker:text-slate-400">
                {group.bullets.map((item) => (
                  <li key={item}>{renderText(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case "details":
      return (
        <dl className="space-y-1.5">
          {block.items.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="font-semibold text-slate-900 sm:w-56 sm:shrink-0">{item.label}:</dt>
              <dd>{renderText(item.value)}</dd>
            </div>
          ))}
        </dl>
      );
  }
}

function SectionRenderer({ section }: { section: LegalSection }) {
  return (
    <section>
      <h3 className="font-semibold text-slate-900">
        {section.number}. {section.title}
      </h3>
      <div className="mt-1.5 space-y-3">
        {section.blocks.map((block, index) => (
          <BlockRenderer key={index} block={block} />
        ))}
      </div>
    </section>
  );
}

/**
 * Scrollable modal showing one legal document (Terms and Conditions or
 * Privacy Notice) during registration. Only one should be open at a time.
 */
export function LegalDocumentModal({ document, onClose }: { document: LegalDocument; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `legal-${document.key}-title`;
  const introId = `legal-${document.key}-intro`;

  useEffect(() => {
    closeRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        className="flex max-h-[min(88vh,46rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{document.eyebrow}</p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {document.title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Effective Date: {document.effectiveDate} · Last Updated: {document.lastUpdated}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${document.title.toLowerCase()}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          <p id={introId} className="text-sm leading-6 text-slate-600">
            {document.key === "terms"
              ? "By creating an account, you agree to these Terms and Conditions. Please read the full document before accepting it below."
              : "This notice explains how your personal information is collected, used, and protected. Please read it in full before accepting it below."}
          </p>
          <div className="mt-5 space-y-5 text-sm leading-6 text-slate-600">
            {document.sections.map((section) => (
              <SectionRenderer key={section.number} section={section} />
            ))}
          </div>
          {document.outro.length > 0 ? (
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              {document.outro.map((paragraph) => (
                <p key={paragraph}>{renderText(paragraph)}</p>
              ))}
            </div>
          ) : null}
          <details className="group mt-6 rounded-xl border border-slate-200 bg-slate-50/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
              Legal References &amp; Sources
              <ChevronDown
                size={17}
                className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="px-4 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {document.references.heading}
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-slate-400">
                {document.references.items.map((item) => (
                  <li key={item.text}>
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        {item.text}
                      </a>
                    ) : (
                      item.text
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </details>
          <div className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            {document.footer.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-slate-500">Close this window and check the boxes to continue registration.</p>
          <Button type="button" tone="secondary" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </footer>
      </section>
    </div>
  );
}
