import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { downloadErrorMessage, filenameFromContentDisposition } from "@/lib/download";

describe("filenameFromContentDisposition", () => {
  it("parses a quoted filename", () => {
    assert.equal(
      filenameFromContentDisposition('attachment; filename="report-2026.pdf"'),
      "report-2026.pdf",
    );
  });

  it("parses an unquoted filename and is case-insensitive on the parameter", () => {
    assert.equal(
      filenameFromContentDisposition("attachment; FILENAME=slip.pdf"),
      "slip.pdf",
    );
  });

  it("prefers RFC 5987 filename* over filename and percent-decodes it", () => {
    assert.equal(
      filenameFromContentDisposition(
        "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''report%20v2.pdf",
      ),
      "report v2.pdf",
    );
    assert.equal(
      filenameFromContentDisposition("inline; filename*=UTF-8''%C3%A9t%C3%A9.pdf"),
      "été.pdf",
    );
  });

  it("returns undefined when no filename is present", () => {
    assert.equal(filenameFromContentDisposition(null), undefined);
    assert.equal(filenameFromContentDisposition(undefined), undefined);
    assert.equal(filenameFromContentDisposition("attachment"), undefined);
    assert.equal(filenameFromContentDisposition("inline"), undefined);
  });

  it("falls back gracefully on malformed percent-encoding in filename*", () => {
    assert.equal(
      filenameFromContentDisposition("attachment; filename*=UTF-8''bad%2"),
      "bad%2",
    );
  });

  it("strips path components from hostile filenames", () => {
    assert.equal(
      filenameFromContentDisposition('attachment; filename="../../evil.pdf"'),
      "evil.pdf",
    );
    assert.equal(
      filenameFromContentDisposition('attachment; filename="C:\\Users\\x\\evil.pdf"'),
      "evil.pdf",
    );
  });

  it("returns undefined when the filename is only a path or empty", () => {
    assert.equal(filenameFromContentDisposition('attachment; filename=".."'), undefined);
    assert.equal(filenameFromContentDisposition('attachment; filename=""'), undefined);
  });
});

describe("downloadErrorMessage", () => {
  it("prefers the server's error message", () => {
    assert.equal(
      downloadErrorMessage(401, { error: "Please sign in to continue." }),
      "Please sign in to continue.",
    );
    assert.equal(
      downloadErrorMessage(403, { error: "Change your password before continuing." }),
      "Change your password before continuing.",
    );
  });

  it("falls back to a status message when the body has no usable error", () => {
    assert.equal(downloadErrorMessage(500, null), "Download failed (HTTP 500). Please try again.");
    assert.equal(downloadErrorMessage(502, { error: 42 }), "Download failed (HTTP 502). Please try again.");
    assert.equal(downloadErrorMessage(404, { error: "" }), "Download failed (HTTP 404). Please try again.");
    assert.equal(downloadErrorMessage(500, "not json"), "Download failed (HTTP 500). Please try again.");
  });
});
