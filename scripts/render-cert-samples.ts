/**
 * Renders sample certificate PDFs for layout verification and manual QA.
 *
 * Verification samples (out/cert-samples/<template>.pdf) are rendered with
 * EMPTY blank values so the reference underscore placeholders print exactly,
 * plus "TESTNAME ..." signatories. `python scripts/cert_layout.py verify` then
 * diffs them glyph-by-glyph against the reference PDFs in public/pdf/.
 *
 * Filled samples (out/cert-samples/filled-*.pdf) exercise real values, the QR
 * code, and the generic fallback frame.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  renderCertificatePdf,
} from "../src/lib/services/certificate-renderer";
import type {
  CertBlankValues,
  CertificateRenderOptions,
} from "../src/lib/services/certificate-renderer";
import type { CertTemplateKey } from "../src/lib/services/certificate-layouts";

const OUT_DIR = join(process.cwd(), "out", "cert-samples");

const TEMPLATES: CertTemplateKey[] = ["good-moral", "enrolment-jhs", "enrolment-shs", "graduation"];

const FILLED: Record<CertTemplateKey, CertBlankValues> = {
  "good-moral": {
    name: "Maria Clara Santos Dela Cruz",
    grade: "11 - STEM",
    schoolYear: "2026-2027",
    day: "12",
    month: "November 2026",
  },
  "enrolment-jhs": {
    name: "Juan Miguel Reyes",
    lrn: "123456789012",
    schoolYear: "2026-2027",
    grade: "9 - Diamond",
    purpose: "scholarship application",
  },
  "enrolment-shs": {
    name: "Ana Lucia Fernandez",
    lrn: "123456789013",
    schoolYear: "2026-2027",
    grade: "12 - STEM",
    purpose: "scholarship",
  },
  graduation: {
    name: "Rafael Antonio Mabini Bautista",
    schoolYear: "2026-2027",
  },
};

const QR_URL = "https://lanhsdrms.online/verify-certificate/0123456789abcdef0123456789abcdef";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const template of TEMPLATES) {
    const verify: CertificateRenderOptions = {
      template,
      blanks: {},
      signatureNames: { registrarName: "TESTNAME REGISTRAR", principalName: "TESTNAME PRINCIPAL" },
    };
    await writeFile(join(OUT_DIR, `${template}.pdf`), await renderCertificatePdf(verify));

    const filled: CertificateRenderOptions = {
      template,
      blanks: FILLED[template],
      signatureNames: { registrarName: "Ariane Joyce L. Estillero", principalName: "Luis G. Villegas" },
      qrUrl: QR_URL,
    };
    await writeFile(join(OUT_DIR, `filled-${template}.pdf`), await renderCertificatePdf(filled));
    console.log(`rendered ${template}`);
  }

  const generic: CertificateRenderOptions = {
    template: null,
    blanks: {},
    signatureNames: { registrarName: "TESTNAME REGISTRAR", principalName: "TESTNAME PRINCIPAL" },
    genericTitle: "CERTIFICATE OF RECOGNITION",
    genericBody:
      "This certifies that Juan Miguel Reyes with LRN 123456789012, in 9 - Diamond for School Year 2026-2027 has a validated school document request recorded in LANHS DRMS. This certificate is issued upon request for awards purposes.",
    qrUrl: QR_URL,
  };
  await writeFile(join(OUT_DIR, "filled-generic.pdf"), await renderCertificatePdf(generic));
  console.log("rendered filled-generic");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
