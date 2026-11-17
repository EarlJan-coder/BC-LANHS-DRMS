import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type { CertTemplateLayout } from "@/lib/services/certificate-layouts";
import { bodySlotWidths, deriveWordingRegions } from "@/lib/services/certificate-wording-regions";

function cloneGoodMoral(): CertTemplateLayout {
  return structuredClone(CERT_LAYOUTS["good-moral"]);
}

describe("deriveWordingRegions", () => {
  it("derives the regions for each template", () => {
    assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["good-moral"]), {
      titleLine: 6,
      bodyLines: { first: 7, last: 14 },
      signatoryTitles: [
        { field: "registrarName", line: 16 },
        { field: "principalName", line: 18 },
      ],
    });
    assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["good-moral-jhs"]), {
      titleLine: 6,
      bodyLines: { first: 7, last: 14 },
      signatoryTitles: [
        { field: "registrarName", line: 16 },
        { field: "principalName", line: 18 },
      ],
    });
    assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["enrolment-jhs"]), {
      titleLine: 6,
      bodyLines: { first: 7, last: 10 },
      signatoryTitles: [{ field: "principalName", line: 12 }],
    });
    assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["enrolment-shs"]), {
      titleLine: 6,
      bodyLines: { first: 7, last: 11 },
      signatoryTitles: [{ field: "principalName", line: 13 }],
    });
    assert.deepEqual(deriveWordingRegions(CERT_LAYOUTS["graduation"]), {
      titleLine: 6,
      bodyLines: { first: 7, last: 11 },
      signatoryTitles: [{ field: "principalName", line: 13 }],
    });
  });

  it("falls back safely when the layout drifts from the expected structure", () => {
    const noSignatures = cloneGoodMoral();
    noSignatures.lines = noSignatures.lines.map((line) => line.filter((token) => token.kind !== "sigName"));
    const noSignaturesRegions = deriveWordingRegions(noSignatures);
    assert.deepEqual(noSignaturesRegions, {
      titleLine: 6,
      bodyLines: { first: 7, last: 22 },
      signatoryTitles: [],
    });

    const oneSignatureMissing = cloneGoodMoral();
    oneSignatureMissing.lines[15] = oneSignatureMissing.lines[15].filter((token) => token.kind !== "sigName");
    assert.deepEqual(deriveWordingRegions(oneSignatureMissing), {
      titleLine: 6,
      bodyLines: { first: 7, last: 16 },
      signatoryTitles: [{ field: "principalName", line: 18 }],
    });
  });
});

describe("bodySlotWidths", () => {
  it("reports per-field slot widths from the body region", () => {
    const layout = CERT_LAYOUTS["good-moral"];
    const regions = deriveWordingRegions(layout);
    assert.deepEqual(bodySlotWidths(layout, regions), {
      name: 99,
      grade: 49.4,
      schoolYear: 60.51,
      day: 38.5,
      month: 71.5,
    });
  });
});
