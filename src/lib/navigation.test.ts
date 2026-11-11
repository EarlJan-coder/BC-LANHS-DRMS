import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNavItemActive, navigationByRole } from "@/lib/navigation";

const studentNav = navigationByRole.student;
const submitRequest = "/student/requests/new";
const myRequests = "/student/requests";

function activeLabels(pathname: string) {
  return studentNav.filter((item) => isNavItemActive(pathname, item.href, studentNav)).map((item) => item.label);
}

describe("isNavItemActive", () => {
  it("lights up Submit request only when the submit form is open", () => {
    assert.deepEqual(activeLabels(submitRequest), ["Submit request"]);
  });

  it("lights up My requests on the request list", () => {
    assert.deepEqual(activeLabels(myRequests), ["My requests"]);
  });

  it("keeps My requests active on a request detail page", () => {
    assert.deepEqual(activeLabels(`${myRequests}/abc-123`), ["My requests"]);
  });

  it("lights up exactly one item for every student route", () => {
    for (const item of studentNav) {
      assert.equal(activeLabels(item.href).length, 1, `expected one active item for ${item.href}`);
    }
    assert.deepEqual(activeLabels("/student/dashboard"), ["Dashboard"]);
    assert.deepEqual(activeLabels("/student/notifications"), ["Notifications"]);
  });

  it("does not treat a partial segment as a prefix match", () => {
    assert.deepEqual(activeLabels("/student/requests-archive"), []);
  });
});
