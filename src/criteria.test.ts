import { describe, expect, it } from "vitest";
import { activeCriteria, criteriaFromSearch, criteriaToSearch, defaultCriteria, matchesCriteria } from "./criteria";
import type { Opportunity } from "./types";

const item: Opportunity = { id: "x", canonical_name: "International Mathematical Olympiad", aliases: ["IMO"], type: "competition", subject_tags: ["Mathematics"], format: "in_person", eligible_grades: ["10"], region_tier: "international_only", audience_scope: "international_selection", entry_pathway: "National team selection", languages: ["English"], team_mode: "individual", current_cycle_status: "open", cost_text: "Free", cost_amount: 0, time_commitment: "medium", publication_status: "official_verified", confidence: "verified", sources: [] };

describe("catalog criteria", () => {
  it("round-trips shareable URL state", () => {
    const criteria = { ...defaultCriteria, query: "math", subjects: ["Physics", "Mathematics"], grade: "10" as const, includeMissing: false };
    expect(criteriaFromSearch(criteriaToSearch(criteria))).toEqual({ ...criteria, subjects: ["Mathematics", "Physics"] });
  });
  it("filters known factual values", () => {
    expect(matchesCriteria(item, { ...defaultCriteria, grade: "10", region: "international_only", access: "international_selection", cost: "free" })).toBe(true);
    expect(matchesCriteria(item, { ...defaultCriteria, grade: "11" })).toBe(false);
  });
  it("includes or excludes missing data explicitly", () => {
    const unknown = { ...item, languages: undefined };
    expect(matchesCriteria(unknown, { ...defaultCriteria, language: "English", includeMissing: true })).toBe(true);
    expect(matchesCriteria(unknown, { ...defaultCriteria, language: "English", includeMissing: false })).toBe(false);
  });
  it("reports active criteria for removable chips", () => {
    expect(activeCriteria({ ...defaultCriteria, subjects: ["Mathematics"], format: "online" }).map((item) => item.key)).toEqual(["subject:Mathematics", "format"]);
  });
  it("searches aliases and entry pathways", () => {
    expect(matchesCriteria(item, { ...defaultCriteria, query: "IMO" })).toBe(true);
    expect(matchesCriteria(item, { ...defaultCriteria, query: "national team" })).toBe(true);
  });
});
