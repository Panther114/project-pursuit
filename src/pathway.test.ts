import { describe, expect, it } from "vitest";
import { opportunities } from "./data";
import { pathwayEdges } from "./data/pathway-edges";
import { findOpportunityByName, orderedNextSteps, pathwayStepsFor } from "./pathway";

describe("pathway helpers", () => {
  it("returns ordered next steps for AMC when edges exist", () => {
    const amc = findOpportunityByName(opportunities, "American Mathematics Competitions");
    expect(amc).toBeTruthy();
    const next = orderedNextSteps(amc!, opportunities, pathwayEdges);
    expect(next.length).toBeGreaterThan(0);
    expect(next[0].direction).toBe("next");
    expect(next[0].opportunity.canonical_name.toLowerCase()).toMatch(/aime|invitational/);
    expect(next[0].relation).toBeTruthy();
  });

  it("returns empty next steps when no edges match", () => {
    const lonely = opportunities.find((item) => item.type === "competition" && item.canonical_name.includes("Photo"));
    expect(lonely).toBeTruthy();
    const next = orderedNextSteps(lonely!, opportunities, []);
    expect(next).toEqual([]);
  });

  it("lists previous and next relations via pathwayStepsFor", () => {
    const aime = findOpportunityByName(opportunities, "American Invitational Mathematics Examination");
    expect(aime).toBeTruthy();
    const steps = pathwayStepsFor(aime!, opportunities, pathwayEdges);
    expect(steps.some((step) => step.direction === "previous")).toBe(true);
    expect(steps.some((step) => step.direction === "next")).toBe(true);
  });
});
