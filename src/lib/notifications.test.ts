import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNewRequestNotification, formatUnreadCount } from "@/lib/notifications";

describe("buildNewRequestNotification", () => {
  it("builds a 'request' notification naming the tracking number and document type", () => {
    const payload = buildNewRequestNotification("LANHS-2026-0001", "Form 137");

    assert.equal(payload.type, "request");
    assert.equal(payload.title, "New document request submitted");
    assert.equal(payload.message, "LANHS-2026-0001 (Form 137) is awaiting registrar review.");
  });
});

describe("formatUnreadCount", () => {
  it("renders no badge when there is nothing unread", () => {
    assert.equal(formatUnreadCount(0), null);
    assert.equal(formatUnreadCount(-3), null);
  });

  it("renders the exact count below the cap", () => {
    assert.equal(formatUnreadCount(1), "1");
    assert.equal(formatUnreadCount(42), "42");
    assert.equal(formatUnreadCount(99), "99");
  });

  it("caps the badge at 99+", () => {
    assert.equal(formatUnreadCount(100), "99+");
    assert.equal(formatUnreadCount(1200), "99+");
  });
});
