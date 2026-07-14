import { describe, expect, it } from "vitest";
import { getCatalogItems, pathForRoute, routeFromPathname } from "./catalog";
import type { Opportunity } from "./types";

const competition: Opportunity = {
  id: "competition",
  canonical_name: "Competition",
  type: "competition",
  subject_tags: ["Mathematics"],
  format: "online",
  website_url: "https://example.org",
  confidence: "partially_verified",
  sources: []
};

const program: Opportunity = {
  ...competition,
  id: "program",
  canonical_name: "Program",
  type: "summer_program"
};

describe("catalog routing", () => {
  it("maps public routes to the intended screen and canonical path", () => {
    expect(routeFromPathname("/competitions")).toBe("competitions");
    expect(routeFromPathname("/programs/")).toBe("programs");
    expect(routeFromPathname("/dreams")).toBe("dreams");
    expect(routeFromPathname("/anything-else")).toBe("home");
    expect(pathForRoute("programs")).toBe("/programs");
    expect(pathForRoute("dreams")).toBe("/dreams");
  });
});

describe("catalog data boundaries", () => {
  it("keeps competitions and programs on separate boards", () => {
    expect(getCatalogItems([competition, program], "competition")).toEqual([competition]);
    expect(getCatalogItems([competition, program], "program")).toEqual([program]);
  });

});
