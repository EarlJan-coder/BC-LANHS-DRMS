import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CERT_LAYOUTS } from "@/lib/services/certificate-layouts";
import type { CertTemplateKey } from "@/lib/services/certificate-layouts";
import { deriveWordingRegions } from "@/lib/services/certificate-wording-regions";
import {
  DEFAULT_WORDING,
  PLACEHOLDER_FIELDS,
} from "@/lib/services/certificate-wording-defaults";

const KEYS = Object.keys(CERT_LAYOUTS) as CertTemplateKey[];

function lineLetters(key: CertTemplateKey, index: number): string {
  return (CERT_LAYOUTS[key].lines[index] ?? [])
    .map((token) => (token.kind === "blank" ? `{{${token.field}}}` : token.kind === "text" ? token.t : ""))
    .join("");
}

function regionLetters(key: CertTemplateKey, first: number, last: number): string {
  const lines: string[] = [];
  for (let index = first; index <= last; index++) lines.push(lineLetters(key, index));
  return lines.join("");
}

describe("certificate wording defaults", () => {
  it("matches the generated layout letter-for-letter (drift guard)", () => {
    for (const key of KEYS) {
      const layout = CERT_LAYOUTS[key];
      const regions = deriveWordingRegions(layout);
      const wording = DEFAULT_WORDING[key];

      const bodyActual = regionLetters(key, regions.bodyLines.first, regions.bodyLines.last);
      const bodyExpected = wording.body.replace(/[ *\n]/g, "");
      assert.equal(bodyActual.replace(/ /g, ""), bodyExpected, `${key} body`);

      const titleActual = lineLetters(key, regions.titleLine).replace(/ /g, "");
      assert.equal(titleActual, wording.title.replace(/ /g, ""), `${key} title`);

      for (const { field, line } of regions.signatoryTitles) {
        const expected = field === "registrarName" ? "SchoolCounselorAssociate1" : "PrincipalIV";
        assert.equal(lineLetters(key, line).replace(/ /g, ""), expected, `${key} ${field} signatory title`);
      }
    }
  });

  it("keeps the digit in School Counselor Associate 1", () => {
    assert.equal(DEFAULT_WORDING["good-moral"].registrarTitle, "School Counselor Associate 1");
    assert.equal(DEFAULT_WORDING["good-moral-jhs"].registrarTitle, "School Counselor Associate 1");
    assert.equal(DEFAULT_WORDING["enrolment-jhs"].registrarTitle, null);
    assert.equal(DEFAULT_WORDING["enrolment-shs"].registrarTitle, null);
    assert.equal(DEFAULT_WORDING.graduation.registrarTitle, null);
  });

  it("uses placeholder-only bodies with the fixed field set", () => {
    for (const key of KEYS) {
      for (const match of DEFAULT_WORDING[key].body.matchAll(/\{\{(\w+)\}\}/g)) {
        assert.ok(
          (PLACEHOLDER_FIELDS as readonly string[]).includes(match[1]),
          `${key} uses unknown placeholder ${match[1]}`,
        );
      }
    }
  });
});
