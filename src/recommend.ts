import type { Opportunity, OpportunityFormat, RegionTier, CurrentCycleStatus } from "./types";

export type StudentProfile = {
  grade: "any" | "9" | "10" | "11" | "12";
  subjects: string[];
  regionPreference: "any" | RegionTier | "china_accessible";
  format: "any" | OpportunityFormat;
  language: "any" | "English" | "Chinese" | "Bilingual";
  teamMode: "any" | "individual" | "team" | "either";
  commitment: "any" | "low" | "medium" | "high";
  budget: "any" | "free" | "paid_ok" | "unknown_ok";
  goals: string[];
  includeIncomplete: boolean;
  preferVerified: boolean;
  limit: number;
};

export type RecommendFactor = {
  key: string;
  label: string;
  points: number;
  max: number;
};

export type Recommendation = {
  opportunity: Opportunity;
  score: number;
  factors: RecommendFactor[];
  reasons: string[];
};

export type RecommendResult = {
  recommendations: Recommendation[];
  excluded: Array<{ id: string; name: string; reason: string }>;
  profile: StudentProfile;
};

export const defaultStudentProfile: StudentProfile = {
  grade: "any",
  subjects: [],
  regionPreference: "any",
  format: "any",
  language: "any",
  teamMode: "any",
  commitment: "any",
  budget: "any",
  goals: [],
  includeIncomplete: true,
  preferVerified: true,
  limit: 12
};

const WEIGHTS = {
  subject: 25,
  timeline: 20,
  chinaAccess: 15,
  commitment: 10,
  cost: 10,
  formatLanguageTeam: 10,
  evidence: 5,
  pathwayGoal: 5
} as const;

function gradesOf(item: Opportunity): string[] {
  return (item.eligible_grades ?? []).map((value) => String(value));
}

function isChinaAccessible(item: Opportunity): boolean {
  const tier = item.region_tier;
  return tier === "shanghai_local" || tier === "mainland_china" || tier === "greater_china" || tier === "china_participation_route";
}

function hasDeadlineSignal(item: Opportunity): boolean {
  return Boolean(item.deadline_date || item.deadline_text || (item.current_cycle_status && item.current_cycle_status !== "unknown"));
}

function isFree(item: Opportunity): boolean {
  if (item.cost_amount === 0) return true;
  return /free|no fee|no separate/i.test(item.cost_text ?? "");
}

function isPaid(item: Opportunity): boolean {
  if (item.cost_amount != null && item.cost_amount > 0) return true;
  return /paid|fee|dues|registration fee|cost/i.test(item.cost_text ?? "") && !isFree(item);
}

function completenessScore(item: Opportunity): number {
  const checks = [
    item.organizer,
    item.website_url,
    item.region_tier,
    item.entry_pathway,
    item.name_zh,
    gradesOf(item).length,
    item.languages?.length,
    item.team_mode && item.team_mode !== "unknown",
    hasDeadlineSignal(item),
    item.cost_text != null || item.cost_amount != null
  ];
  return checks.filter(Boolean).length;
}

function hardExclude(item: Opportunity, profile: StudentProfile): string | null {
  if (item.type !== "competition") return "Not a competition";
  if (profile.grade !== "any") {
    const grades = gradesOf(item);
    if (grades.length && !grades.includes(profile.grade)) {
      return `Grade ${profile.grade} not in published eligibility (${grades.join(", ")})`;
    }
    if (!grades.length && !profile.includeIncomplete) return "Eligible grades unknown";
  }
  if (profile.regionPreference !== "any") {
    if (profile.regionPreference === "china_accessible") {
      if (item.region_tier && !isChinaAccessible(item) && item.region_tier !== "international_only") {
        return "Outside preferred China-accessible region tiers";
      }
      // international_only is allowed unless user requires china-only later; china_accessible prefers but does not hard-block international open contests
    } else if (item.region_tier && item.region_tier !== profile.regionPreference) {
      if (!profile.includeIncomplete) return `Region tier is ${item.region_tier}`;
      // when includeIncomplete, soft-filter only if known mismatch for strict non-china prefs
      if (profile.regionPreference !== "international_only") return `Region tier is ${item.region_tier}`;
    } else if (!item.region_tier && !profile.includeIncomplete) {
      return "Region tier unknown";
    }
  }
  if (profile.format !== "any") {
    if (item.format === "unknown" && !profile.includeIncomplete) return "Format unknown";
    if (item.format !== "unknown" && item.format !== "hybrid" && item.format !== profile.format) {
      return `Format is ${item.format}`;
    }
  }
  if (profile.language !== "any") {
    const langs = item.languages ?? [];
    if (!langs.length && !profile.includeIncomplete) return "Language unknown";
    if (langs.length && !langs.includes(profile.language) && !langs.includes("Bilingual")) {
      return `Languages are ${langs.join(", ")}`;
    }
  }
  if (profile.teamMode !== "any") {
    if ((!item.team_mode || item.team_mode === "unknown") && !profile.includeIncomplete) return "Team mode unknown";
    if (item.team_mode && item.team_mode !== "unknown" && item.team_mode !== "either" && item.team_mode !== profile.teamMode) {
      return `Team mode is ${item.team_mode}`;
    }
  }
  if (profile.commitment !== "any") {
    if ((!item.time_commitment || item.time_commitment === "unknown") && !profile.includeIncomplete) return "Commitment unknown";
    if (item.time_commitment && item.time_commitment !== "unknown" && item.time_commitment !== profile.commitment) {
      return `Time commitment is ${item.time_commitment}`;
    }
  }
  if (profile.budget === "free") {
    const missingCost = item.cost_amount == null && !item.cost_text;
    if (missingCost && !profile.includeIncomplete) return "Cost unknown";
    if (!missingCost && !isFree(item)) return "Not marked free";
  }
  if (item.current_cycle_status === "closed" && profile.goals.includes("open_now")) {
    return "Cycle status closed";
  }
  return null;
}

function scoreItem(item: Opportunity, profile: StudentProfile): Recommendation {
  const factors: RecommendFactor[] = [];
  let score = 0;

  // Subject overlap
  let subjectPoints = 0;
  if (profile.subjects.length) {
    const overlap = profile.subjects.filter((subject) => item.subject_tags.includes(subject)).length;
    subjectPoints = Math.round((overlap / profile.subjects.length) * WEIGHTS.subject);
  } else {
    subjectPoints = Math.round(WEIGHTS.subject * 0.4);
  }
  factors.push({ key: "subject", label: "Subject overlap", points: subjectPoints, max: WEIGHTS.subject });
  score += subjectPoints;

  // Timeline / deadline feasibility signal
  let timelinePoints = 0;
  const cycle = item.current_cycle_status as CurrentCycleStatus | undefined;
  if (cycle === "open" || cycle === "rolling") timelinePoints = WEIGHTS.timeline;
  else if (cycle === "upcoming") timelinePoints = Math.round(WEIGHTS.timeline * 0.8);
  else if (hasDeadlineSignal(item)) timelinePoints = Math.round(WEIGHTS.timeline * 0.55);
  else timelinePoints = Math.round(WEIGHTS.timeline * 0.2);
  factors.push({ key: "timeline", label: "Deadline / cycle signal", points: timelinePoints, max: WEIGHTS.timeline });
  score += timelinePoints;

  // China access
  let chinaPoints = 0;
  if (profile.regionPreference === "china_accessible" || profile.regionPreference === "china_participation_route" || profile.regionPreference === "mainland_china") {
    if (isChinaAccessible(item)) chinaPoints = WEIGHTS.chinaAccess;
    else if (item.region_tier === "international_only" && (item.audience_scope === "global_open" || item.format === "online")) chinaPoints = Math.round(WEIGHTS.chinaAccess * 0.45);
    else chinaPoints = Math.round(WEIGHTS.chinaAccess * 0.15);
  } else if (item.region_tier) {
    chinaPoints = Math.round(WEIGHTS.chinaAccess * 0.5);
  }
  if (item.entry_pathway) chinaPoints = Math.min(WEIGHTS.chinaAccess, chinaPoints + 2);
  factors.push({ key: "chinaAccess", label: "China access / entry pathway", points: chinaPoints, max: WEIGHTS.chinaAccess });
  score += chinaPoints;

  // Commitment fit
  let commitmentPoints = Math.round(WEIGHTS.commitment * 0.5);
  if (profile.commitment !== "any" && item.time_commitment === profile.commitment) commitmentPoints = WEIGHTS.commitment;
  else if (!item.time_commitment || item.time_commitment === "unknown") commitmentPoints = Math.round(WEIGHTS.commitment * 0.25);
  factors.push({ key: "commitment", label: "Time commitment fit", points: commitmentPoints, max: WEIGHTS.commitment });
  score += commitmentPoints;

  // Cost fit
  let costPoints = Math.round(WEIGHTS.cost * 0.4);
  if (profile.budget === "free" && isFree(item)) costPoints = WEIGHTS.cost;
  else if (profile.budget === "paid_ok" && (isPaid(item) || isFree(item))) costPoints = Math.round(WEIGHTS.cost * 0.85);
  else if (profile.budget === "unknown_ok") costPoints = Math.round(WEIGHTS.cost * 0.7);
  else if (item.cost_text || item.cost_amount != null) costPoints = Math.round(WEIGHTS.cost * 0.6);
  factors.push({ key: "cost", label: "Cost signal fit", points: costPoints, max: WEIGHTS.cost });
  score += costPoints;

  // Format / language / team
  let flt = 0;
  const fltMax = WEIGHTS.formatLanguageTeam;
  if (profile.format === "any" || item.format === profile.format || item.format === "hybrid") flt += 4;
  else if (item.format === "unknown") flt += 1;
  if (profile.language === "any" || (item.languages ?? []).includes(profile.language) || (item.languages ?? []).includes("Bilingual")) flt += 3;
  if (profile.teamMode === "any" || item.team_mode === profile.teamMode || item.team_mode === "either") flt += 3;
  flt = Math.min(fltMax, flt);
  factors.push({ key: "formatLanguageTeam", label: "Format / language / team fit", points: flt, max: fltMax });
  score += flt;

  // Evidence quality
  let evidencePoints = 0;
  const status = item.publication_status;
  if (status === "official_verified") evidencePoints = WEIGHTS.evidence;
  else if (status === "corroborated") evidencePoints = Math.round(WEIGHTS.evidence * 0.8);
  else if (status === "partially_verified" || item.confidence === "verified" || item.confidence === "partially_verified") evidencePoints = Math.round(WEIGHTS.evidence * 0.55);
  else evidencePoints = Math.round(WEIGHTS.evidence * 0.2);
  if (profile.preferVerified) evidencePoints = Math.min(WEIGHTS.evidence, evidencePoints + Math.min(2, Math.floor(completenessScore(item) / 4)));
  factors.push({ key: "evidence", label: "Source evidence quality", points: evidencePoints, max: WEIGHTS.evidence });
  score += evidencePoints;

  // Goal keywords (never admissions probability)
  let goalPoints = 0;
  const blob = `${item.canonical_name} ${item.description ?? ""} ${item.entry_pathway ?? ""} ${(item.subject_tags ?? []).join(" ")}`.toLowerCase();
  for (const goal of profile.goals) {
    const g = goal.toLowerCase();
    if (!g) continue;
    if (g === "research" && /research|isef|sts|yau|genius|science fair/.test(blob)) goalPoints += 2;
    else if (g === "olympiad" && /olympiad|usamo|bmo|noi|usaco|bp ho|bpho/.test(blob)) goalPoints += 2;
    else if (g === "writing" && /essay|writing|lock|poetry|scholar/.test(blob)) goalPoints += 2;
    else if (g === "business" && /business|econ|finance|investment|deca|fbla|pitch/.test(blob)) goalPoints += 2;
    else if (blob.includes(g)) goalPoints += 1;
  }
  goalPoints = Math.min(WEIGHTS.pathwayGoal, goalPoints);
  factors.push({ key: "pathwayGoal", label: "Goal keyword alignment", points: goalPoints, max: WEIGHTS.pathwayGoal });
  score += goalPoints;

  // Completeness soft boost for better menu defaults (not a prestige score)
  score += Math.min(3, Math.floor(completenessScore(item) / 3));

  const reasons = factors
    .filter((factor) => factor.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((factor) => `${factor.label}: ${factor.points}/${factor.max}`);

  if (item.entry_pathway) reasons.unshift(`Entry pathway: ${item.entry_pathway.slice(0, 120)}${item.entry_pathway.length > 120 ? "…" : ""}`);
  if (item.region_tier) reasons.push(`Region tier: ${item.region_tier.replaceAll("_", " ")}`);
  // Safety: never emit admissions language
  const cleaned = reasons.filter((reason) => !/admission|chance|probability|prestige score|含金量/i.test(reason));

  return { opportunity: item, score, factors, reasons: cleaned };
}

export function recommendCompetitions(items: Opportunity[], profileInput: Partial<StudentProfile> = {}): RecommendResult {
  const profile: StudentProfile = { ...defaultStudentProfile, ...profileInput, subjects: profileInput.subjects ?? defaultStudentProfile.subjects, goals: profileInput.goals ?? defaultStudentProfile.goals };
  const excluded: RecommendResult["excluded"] = [];
  const scored: Recommendation[] = [];

  for (const item of items) {
    if (item.type !== "competition") continue;
    const reason = hardExclude(item, profile);
    if (reason) {
      excluded.push({ id: item.id, name: item.canonical_name, reason });
      continue;
    }
    scored.push(scoreItem(item, profile));
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.opportunity.canonical_name.localeCompare(b.opportunity.canonical_name);
  });

  // Light diversity: avoid adjacent near-duplicate subject piles by mild reordering
  const diversified: Recommendation[] = [];
  const rest = [...scored];
  const seenSubjects = new Map<string, number>();
  while (rest.length && diversified.length < profile.limit) {
    let bestIndex = 0;
    let bestPenalty = Infinity;
    for (let index = 0; index < Math.min(rest.length, 15); index += 1) {
      const primary = rest[index].opportunity.subject_tags[0] ?? "other";
      const count = seenSubjects.get(primary) ?? 0;
      const penalty = count * 4 - rest[index].score / 100;
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    }
    const [picked] = rest.splice(bestIndex, 1);
    diversified.push(picked);
    const primary = picked.opportunity.subject_tags[0] ?? "other";
    seenSubjects.set(primary, (seenSubjects.get(primary) ?? 0) + 1);
  }

  return { recommendations: diversified, excluded, profile };
}

export function sortCompetitionsForBrowse(items: Opportunity[], preferVerified = true): Opportunity[] {
  return [...items].filter((item) => item.type === "competition").sort((a, b) => {
    if (preferVerified) {
      const rank = (item: Opportunity) => {
        if (item.publication_status === "official_verified") return 0;
        if (item.publication_status === "corroborated") return 1;
        if (item.publication_status === "partially_verified") return 2;
        if (item.confidence === "verified") return 2;
        return 3;
      };
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
    }
    const completeDiff = completenessScore(b) - completenessScore(a);
    if (completeDiff !== 0) return completeDiff;
    return a.canonical_name.localeCompare(b.canonical_name);
  });
}
