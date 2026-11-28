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
  });

  it("does not light up anything on the notifications page (nav entry replaced by the header bell)", () => {
    assert.deepEqual(activeLabels("/student/notifications"), []);
  });

  it("does not treat a partial segment as a prefix match", () => {
    assert.deepEqual(activeLabels("/student/requests-archive"), []);
  });
});

describe("admin navigation parity", () => {
  it("includes the admin workflow pages and omits the removed student and logs pages", () => {
    const hrefs = navigationByRole.admin.map((item) => item.href);
    for (const href of ["/admin/requests", "/admin/certificates", "/admin/reports", "/admin/users"]) {
      assert.ok(hrefs.includes(href), `missing admin navigation item: ${href}`);
    }
    assert.ok(!hrefs.includes("/admin/students"));
    assert.ok(!hrefs.includes("/admin/audit-logs"));
  });

  it("groups admin links into a clear sidebar hierarchy", () => {
    const nav = navigationByRole.admin;
    const sectionHeadings = nav
      .filter((item, index) => item.section !== nav[index - 1]?.section)
      .map((item) => item.section);
    assert.deepEqual(sectionHeadings, ["Overview", "Student services", "Administration", "System"]);
    assert.deepEqual(nav.filter((item) => item.section === "Student services").map((item) => item.label), [
      "Requests", "Registrations", "Certificates", "Reports",
    ]);
  });
});

describe("portal sidebar hierarchy", () => {
  it("groups registrar work into workflow, records, and insights", () => {
    const sections = navigationByRole.registrar
      .filter((item, index) => item.section !== navigationByRole.registrar[index - 1]?.section)
      .map((item) => item.section);
    assert.deepEqual(sections, ["Overview", "Workflow", "Records", "Insights"]);
  });

  it("groups student links into overview, requests, and account", () => {
    const sections = navigationByRole.student
      .filter((item, index) => item.section !== navigationByRole.student[index - 1]?.section)
      .map((item) => item.section);
    assert.deepEqual(sections, ["Overview", "Requests", "Account"]);
  });
});
