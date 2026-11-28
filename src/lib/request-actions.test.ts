import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REQUEST_ACTIONS, buildStatusUpdatePayload, disabledStatusActions, visibleStatusActions } from "@/lib/request-actions";

describe("REQUEST_ACTIONS", () => {
  it("is exactly the five registrar status actions", () => {
    assert.deepEqual(
      REQUEST_ACTIONS.map((action) => action.status),
      ["approved", "rejected", "processing", "ready_for_pickup", "claimed"],
    );
  });

  it("uses the approved labels", () => {
    assert.deepEqual(
      REQUEST_ACTIONS.map((action) => action.label),
      ["Approved", "Reject", "Processing", "Ready for Pickup", "Claimed"],
    );
  });

  it("gives each action a distinct status color", () => {
    const colors = REQUEST_ACTIONS.map((action) => action.color);
    assert.deepEqual(colors, ["green", "red", "amber", "blue", "purple"]);
    assert.equal(new Set(colors).size, 5);
  });

  it("includes a confirmation message per action", () => {
    for (const action of REQUEST_ACTIONS) {
      assert.ok(action.confirm.length > 0, `missing confirm for ${action.status}`);
    }
  });
});

describe("buildStatusUpdatePayload", () => {
  it("returns null when rejecting without a reason", () => {
    assert.equal(buildStatusUpdatePayload("rejected"), null);
    assert.equal(buildStatusUpdatePayload("rejected", ""), null);
    assert.equal(buildStatusUpdatePayload("rejected", "   "), null);
  });

  it("embeds the rejection reason in registrarRemarks", () => {
    const payload = buildStatusUpdatePayload("rejected", "Missing requirements");
    assert.ok(payload);
    assert.equal(payload.status, "rejected");
    assert.equal(payload.rejectionReason, "Missing requirements");
    assert.equal(payload.registrarRemarks, "Registrar rejected this request. Reason: Missing requirements");
    assert.equal(payload.remarks, "Status updated to rejected.");
  });

  it("uses the active staff role in generated remarks", () => {
    const payload = buildStatusUpdatePayload("processing", undefined, "Administrator");
    assert.equal(payload?.registrarRemarks, "Administrator marked this request as processing.");
  });

  it("builds payloads for the non-reject statuses without a rejection reason", () => {
    for (const status of ["approved", "processing", "ready_for_pickup", "claimed"] as const) {
      const payload = buildStatusUpdatePayload(status);
      assert.ok(payload, `payload missing for ${status}`);
      assert.equal(payload.status, status);
      assert.equal(payload.rejectionReason, undefined);
      assert.equal(payload.registrarRemarks, `Registrar marked this request as ${status.replaceAll("_", " ")}.`);
      assert.equal(payload.remarks, `Status updated to ${status}.`);
    }
  });
});

describe("disabledStatusActions", () => {
  it("disables nothing while the request is pending, under review, or cancelled", () => {
    for (const status of ["pending", "under_review", "cancelled"] as const) {
      assert.deepEqual(disabledStatusActions(status), []);
    }
  });

  it("locks the approve/reject pair once the request is approved", () => {
    assert.deepEqual(disabledStatusActions("approved"), ["approved", "rejected"]);
  });

  it("disables every action once the request is rejected", () => {
    assert.deepEqual(disabledStatusActions("rejected"), [
      "approved",
      "rejected",
      "processing",
      "ready_for_pickup",
      "claimed",
    ]);
  });

  it("locks the approve/reject pair while processing", () => {
    assert.deepEqual(disabledStatusActions("processing"), ["approved", "rejected"]);
  });

  it("adds Processing once ready for pickup", () => {
    assert.deepEqual(disabledStatusActions("ready_for_pickup"), ["approved", "rejected", "processing"]);
  });

  it("locks every earlier stage once claimed", () => {
    assert.deepEqual(disabledStatusActions("claimed"), ["approved", "rejected", "processing", "ready_for_pickup"]);
  });

  it("disables nothing when the status is unknown", () => {
    assert.deepEqual(disabledStatusActions(undefined), []);
  });
});

describe("visibleStatusActions", () => {
  it("shows only approval actions before approval and after rejection", () => {
    for (const status of ["pending", "under_review", "cancelled", "rejected"] as const) {
      assert.deepEqual(visibleStatusActions(status), ["approved", "rejected"]);
    }
    assert.deepEqual(visibleStatusActions(undefined), ["approved", "rejected"]);
  });

  it("shows workflow actions after approval", () => {
    const actions = ["approved", "rejected", "processing", "ready_for_pickup", "claimed"];
    for (const status of ["approved", "processing", "ready_for_pickup", "claimed"] as const) {
      assert.deepEqual(visibleStatusActions(status), actions);
    }
  });
});
