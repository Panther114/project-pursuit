import { describe, expect, it } from "vitest";
import { evaluateFit } from "./recommendations";
import type { Opportunity, Preferences } from "./types";

const baseOpportunity: Opportunity = {
  id: "x",
  canonical_name: "American Mathematics Competition",
  type: "competition",
  subject_tags: ["Mathematics"],
  format: "online",
  deadline_text: "Sep.10",
  confidence: "partially_verified",
  sources: []
};

const prefs: Preferences = {
  grade: "10",
  subjects: ["Mathematics"],
  format: "online",
  horizon: "any",
  goal: "olympiad"
};

describe("evaluateFit", () => {
  it("rewards subject and format matches", () => {
    const result = evaluateFit(baseOpportunity, prefs);
    expect(result.score).toBeGreaterThan(75);
    expect(result.reasons.join(" ")).toContain("Subject match");
  });

  it("penalizes missing deadlines and low confidence", () => {
    const result = evaluateFit({ ...baseOpportunity, deadline_text: "", confidence: "needs_review" }, prefs);
    expect(result.score).toBeLessThan(70);
    expect(result.cautions.join(" ")).toContain("deadline");
  });
});
