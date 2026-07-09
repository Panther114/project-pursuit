import type { FitResult, Opportunity, Preferences } from "./types";

const confidencePenalty: Record<string, number> = {
  verified: 0,
  partially_verified: 4,
  historical_information_only: 14,
  unverified: 22,
  needs_review: 28
};

export function evaluateFit(opportunity: Opportunity, preferences: Preferences): FitResult {
  let score = 52;
  const reasons: string[] = [];
  const cautions: string[] = [];

  const selectedSubjects = preferences.subjects.map((subject) => subject.toLowerCase());
  const opportunitySubjects = opportunity.subject_tags.map((subject) => subject.toLowerCase());
  const subjectMatches = selectedSubjects.filter((subject) => opportunitySubjects.includes(subject.toLowerCase()));

  if (selectedSubjects.length === 0 || selectedSubjects.includes("any")) {
    reasons.push("No subject preference set; showing broad-fit opportunities.");
  } else if (subjectMatches.length > 0) {
    score += 26;
    reasons.push(`Subject match: ${subjectMatches.join(", ")}.`);
  } else {
    score -= 16;
    cautions.push("Subject area does not match the current preference profile.");
  }

  if (preferences.format !== "any") {
    if (opportunity.format === preferences.format || opportunity.format === "hybrid") {
      score += 10;
      reasons.push("Format matches the preferred participation mode.");
    } else {
      score -= 8;
      cautions.push("Format may require a different participation mode.");
    }
  }

  if (preferences.goal !== "any") {
    const text = `${opportunity.canonical_name} ${opportunity.category ?? ""} ${opportunity.preparation ?? ""} ${opportunity.description ?? ""}`.toLowerCase();
    const goalMatch =
      (preferences.goal === "research" && text.includes("research")) ||
      (preferences.goal === "olympiad" && (text.includes("olympiad") || text.includes("contest") || text.includes("competition"))) ||
      (preferences.goal === "writing" && (text.includes("writing") || text.includes("essay"))) ||
      (preferences.goal === "business" && text.includes("business")) ||
      (preferences.goal === "summer" && opportunity.type === "summer_program");
    if (goalMatch) {
      score += 12;
      reasons.push("Goal alignment is visible in the source category or preparation notes.");
    }
  }

  const penalty = confidencePenalty[opportunity.confidence] ?? 20;
  if (penalty > 0) {
    score -= penalty;
    cautions.push(`Confidence penalty applied: ${formatConfidence(opportunity.confidence)}.`);
  } else {
    reasons.push("Critical details are verified.");
  }

  if (!opportunity.deadline_text) {
    score -= 8;
    cautions.push("Registration deadline is missing and needs review.");
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: bounded,
    label: bounded >= 78 ? "Strong fit" : bounded >= 58 ? "Worth reviewing" : "Review carefully",
    reasons,
    cautions
  };
}

export function formatConfidence(confidence: Opportunity["confidence"]): string {
  return confidence
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
