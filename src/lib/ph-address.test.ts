import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CITIES, CITY_NAMES, composeAddress, barangaysFor } from "./ph-address";

describe("CITIES", () => {
  it("lists the approved cities", () => {
    assert.deepEqual(CITY_NAMES, [
      "Trece Martires City",
      "Tanza",
      "Naic",
      "Indang",
      "General Trias",
      "Dasmariñas",
      "Carmona",
      "Tagaytay",
    ]);
  });

  it("gives every city at least one barangay", () => {
    for (const [city, barangays] of Object.entries(CITIES)) {
      assert.ok(barangays.length > 0, `${city} has no barangays`);
      for (const barangay of barangays) {
        assert.ok(barangay.trim().length > 0, `${city} has a blank barangay`);
      }
    }
  });
});

describe("barangaysFor", () => {
  it("returns the barangays for a known city", () => {
    const barangays = barangaysFor("Trece Martires City");
    assert.ok(barangays.includes("Aguado"));
    assert.equal(barangays.length, 13);
  });

  it("returns an empty array for an unknown city", () => {
    assert.deepEqual(barangaysFor("Manila"), []);
  });
});

describe("composeAddress", () => {
  it("joins street line, barangay, and city in order", () => {
    assert.equal(
      composeAddress({ streetLine: "123 Mabini St.", barangay: "Aguado", city: "Trece Martires City" }),
      "123 Mabini St., Brgy. Aguado, Trece Martires City",
    );
  });

  it("trims whitespace around each part", () => {
    assert.equal(
      composeAddress({ streetLine: "  123 Mabini St. ", barangay: " Aguado ", city: "Tanza" }),
      "123 Mabini St., Brgy. Aguado, Tanza",
    );
  });
});
