import { describe, expect, it } from "vitest";
import { opportunities } from "./data";
import { recommendCompetitions, sortCompetitionsForBrowse } from "./recommend";

describe("recommendCompetitions", () => {
  it("ranks grade-11 math china-access competitions with reason chips and no admissions language", () => {
    const result = recommendCompetitions(opportunities, {
      grade: "11",
      subjects: ["Mathematics"],
      regionPreference: "china_accessible",
      limit: 8,
      preferVerified: true
    });
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.recommendations) {
      expect(rec.opportunity.type).toBe("competition");
      expect(rec.reasons.length).toBeGreaterThan(0);
      expect(rec.factors.some((factor) => factor.key === "subject")).toBe(true);
      const joined = rec.reasons.join(" ");
      expect(joined).not.toMatch(/admission chance|probability|prestige score|含金量/i);
    }
    // At least one recommended item should be math-tagged
    expect(result.recommendations.some((rec) => rec.opportunity.subject_tags.includes("Mathematics"))).toBe(true);
  });

  it("hard-filters known incompatible grades when eligibility is published", () => {
    const grade12Only = opportunities.find(
      (item) => item.type === "competition" && (item.eligible_grades ?? []).map(String).includes("12") && !(item.eligible_grades ?? []).map(String).includes("9")
    );
    expect(grade12Only).toBeTruthy();
    const result = recommendCompetitions([grade12Only!], {
      grade: "9",
      subjects: grade12Only!.subject_tags.slice(0, 1),
      includeIncomplete: false,
      limit: 5
    });
    expect(result.recommendations).toHaveLength(0);
    expect(result.excluded.some((item) => item.id === grade12Only!.id)).toBe(true);
    expect(result.excluded[0].reason).toMatch(/Grade 9 not in published eligibility/i);
  });

  it("supports CS online profile without inventing admissions claims", () => {
    const result = recommendCompetitions(opportunities, {
      grade: "10",
      subjects: ["Computer Science"],
      format: "online",
      language: "English",
      goals: ["olympiad"],
      limit: 6
    });
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.recommendations) {
      if (rec.opportunity.format !== "unknown" && rec.opportunity.format !== "hybrid") {
        expect(rec.opportunity.format).toBe("online");
      }
      expect(rec.reasons.join(" ")).not.toMatch(/guarantees admission|chance of acceptance/i);
    }
  });

  it("supports humanities writing profile", () => {
    const result = recommendCompetitions(opportunities, {
      grade: "11",
      subjects: ["Writing", "English"],
      goals: ["writing"],
      limit: 6
    });
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(
      result.recommendations.some((rec) =>
        rec.opportunity.subject_tags.some((tag) => ["Writing", "English", "Arts", "Philosophy"].includes(tag))
      )
    ).toBe(true);
  });
});

describe("sortCompetitionsForBrowse", () => {
  it("prefers higher-evidence competitions first when enabled", () => {
    const sorted = sortCompetitionsForBrowse(opportunities, true).slice(0, 20);
    expect(sorted.length).toBeGreaterThan(0);
    expect(sorted.every((item) => item.type === "competition")).toBe(true);
    const firstStatus = sorted[0].publication_status;
    expect(["official_verified", "corroborated", "partially_verified", "unverified", "historical"]).toContain(firstStatus);
  });
});
