import type { Opportunity, OpportunityFormat } from "./types";

export type CatalogCriteria = {
  query: string;
  subjects: string[];
  subtype: "any" | Opportunity["type"];
  grade: "any" | "9" | "10" | "11" | "12";
  region: "any" | NonNullable<Opportunity["region_tier"]>;
  format: "any" | OpportunityFormat;
  language: "any" | "English" | "Chinese" | "Bilingual";
  teamMode: "any" | "individual" | "team" | "either";
  cycleStatus: "any" | NonNullable<Opportunity["current_cycle_status"]>;
  cost: "any" | "free" | "paid" | "not_published";
  commitment: "any" | "low" | "medium" | "high";
  sourceStatus: "any" | "official_verified" | "corroborated" | "partially_verified" | "historical" | "unverified";
  includeMissing: boolean;
};

export const defaultCriteria: CatalogCriteria = {
  query: "", subjects: [], subtype: "any", grade: "any", region: "any", format: "any",
  language: "any", teamMode: "any", cycleStatus: "any", cost: "any", commitment: "any",
  sourceStatus: "any", includeMissing: true
};

const keys: Array<keyof CatalogCriteria> = ["subtype", "grade", "region", "format", "language", "teamMode", "cycleStatus", "cost", "commitment", "sourceStatus"];

export function criteriaFromSearch(search: string): CatalogCriteria {
  const params = new URLSearchParams(search);
  const result: CatalogCriteria = { ...defaultCriteria, subjects: [] };
  result.query = params.get("q") ?? "";
  result.subjects = params.getAll("subject").filter(Boolean);
  for (const key of keys) {
    const value = params.get(key);
    if (value) (result[key] as string) = value;
  }
  result.includeMissing = params.get("missing") !== "exclude";
  return result;
}

export function criteriaToSearch(criteria: CatalogCriteria): string {
  const params = new URLSearchParams();
  if (criteria.query.trim()) params.set("q", criteria.query.trim());
  criteria.subjects.slice().sort().forEach((subject) => params.append("subject", subject));
  for (const key of keys) if (criteria[key] !== "any") params.set(key, String(criteria[key]));
  if (!criteria.includeMissing) params.set("missing", "exclude");
  const value = params.toString();
  return value ? `?${value}` : "";
}

function matchKnown<T>(actual: T | null | undefined, expected: T | "any", includeMissing: boolean): boolean {
  if (expected === "any") return true;
  if (actual == null || actual === "") return includeMissing;
  return actual === expected;
}

export function matchesCriteria(item: Opportunity, criteria: CatalogCriteria): boolean {
  const needle = criteria.query.trim().toLowerCase();
  if (needle && ![item.canonical_name, item.name_zh, item.description, item.category, item.region, item.organizer]
    .filter(Boolean).join(" ").toLowerCase().includes(needle)) return false;
  if (criteria.subjects.length && !criteria.subjects.some((subject) => item.subject_tags.includes(subject))) return false;
  if (!matchKnown(item.type, criteria.subtype, criteria.includeMissing)) return false;
  if (criteria.grade !== "any" && item.eligible_grades?.length && !item.eligible_grades.includes(criteria.grade)) return false;
  if (criteria.grade !== "any" && !item.eligible_grades?.length && !criteria.includeMissing) return false;
  if (!matchKnown(item.region_tier, criteria.region, criteria.includeMissing)) return false;
  if (criteria.format !== "any" && item.format !== "hybrid" && !matchKnown(item.format, criteria.format, criteria.includeMissing)) return false;
  if (criteria.language !== "any" && item.languages?.length && !item.languages.includes(criteria.language) && !item.languages.includes("Bilingual")) return false;
  if (criteria.language !== "any" && !item.languages?.length && !criteria.includeMissing) return false;
  if (criteria.teamMode !== "any" && item.team_mode !== "either" && !matchKnown(item.team_mode, criteria.teamMode, criteria.includeMissing)) return false;
  if (!matchKnown(item.current_cycle_status, criteria.cycleStatus, criteria.includeMissing)) return false;
  if (!matchKnown(item.time_commitment, criteria.commitment, criteria.includeMissing)) return false;
  if (criteria.sourceStatus !== "any" && !matchKnown(item.publication_status ?? legacyPublicationStatus(item), criteria.sourceStatus, criteria.includeMissing)) return false;
  if (criteria.cost !== "any") {
    const missing = !item.cost_text && item.cost_amount == null;
    if (missing && !criteria.includeMissing) return false;
    if (!missing && criteria.cost === "free" && !(item.cost_amount === 0 || /free|no fee/i.test(item.cost_text ?? ""))) return false;
    if (!missing && criteria.cost === "paid" && (item.cost_amount === 0 || /free|no fee/i.test(item.cost_text ?? ""))) return false;
    if (!missing && criteria.cost === "not_published" && !/not published|not stated|unknown/i.test(item.cost_text ?? "")) return false;
  }
  return true;
}

export function legacyPublicationStatus(item: Opportunity): NonNullable<Opportunity["publication_status"]> {
  if (item.confidence === "verified") return "official_verified";
  if (item.confidence === "historical_information_only") return "historical";
  return "partially_verified";
}

export function activeCriteria(criteria: CatalogCriteria): Array<{ key: string; label: string }> {
  const active: Array<{ key: string; label: string }> = [];
  if (criteria.query) active.push({ key: "query", label: `“${criteria.query}”` });
  criteria.subjects.forEach((subject) => active.push({ key: `subject:${subject}`, label: subject }));
  for (const key of keys) if (criteria[key] !== "any") active.push({ key, label: `${prettyKey(key)}: ${prettyKey(String(criteria[key]))}` });
  if (!criteria.includeMissing) active.push({ key: "includeMissing", label: "Known data only" });
  return active;
}

function prettyKey(value: string): string { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
