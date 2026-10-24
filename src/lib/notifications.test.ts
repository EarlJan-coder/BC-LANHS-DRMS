import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNewRequestNotification, formatUnreadCount } from "@/lib/notifications";

describe("buildNewRequestNotification", () => {
  it("builds the registrar notification for a submitted student request", () => {
    const notification = buildNewRequestNotification("DR-2026-0012", "Good Moral Certificate");
    assert.deepEqual(notification, {
      type: "request",
      title: "New document request submitted",
      message: "DR-2026-0012 (Good Moral Certificate) is awaiting registrar review.",
    });
  });
});

describe("formatUnreadCount", () => {
  it("returns null for zero (no badge)", () => {
    assert.equal(formatUnreadCount(0), null);
    assert.equal(formatUnreadCount(-3), null);
  });

  it("returns the plain number below 100", () => {
    assert.equal(formatUnreadCount(1), "1");
    assert.equal(formatUnreadCount(99), "99");
  });

  it("caps at 99+", () => {
    assert.equal(formatUnreadCount(100), "99+");
    assert.equal(formatUnreadCount(1234), "99+");
  });
});
