import type { Opportunity } from "./types";

export type PathwayEdge = {
  from: string;
  to: string;
  relation: string;
  note?: string;
};

export type PathwayStep = {
  opportunity: Opportunity;
  relation: string;
  note?: string;
  direction: "next" | "previous";
};

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesName(item: Opportunity, name: string): boolean {
  const target = norm(name);
  const candidates = [item.canonical_name, item.name_en, ...(item.aliases ?? [])].filter(Boolean) as string[];
  return candidates.some((candidate) => norm(candidate) === target);
}

export function findOpportunityByName(items: Opportunity[], name: string): Opportunity | undefined {
  return items.find((item) => item.type === "competition" && matchesName(item, name));
}

export function pathwayStepsFor(
  item: Opportunity,
  items: Opportunity[],
  edges: PathwayEdge[]
): PathwayStep[] {
  if (item.type !== "competition") return [];
  const steps: PathwayStep[] = [];
  for (const edge of edges) {
    if (matchesName(item, edge.from)) {
      const next = findOpportunityByName(items, edge.to);
      if (next) steps.push({ opportunity: next, relation: edge.relation, note: edge.note, direction: "next" });
    }
    if (matchesName(item, edge.to)) {
      const prev = findOpportunityByName(items, edge.from);
      if (prev) steps.push({ opportunity: prev, relation: edge.relation, note: edge.note, direction: "previous" });
    }
  }
  // de-dupe by opportunity id + direction
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.direction}:${step.opportunity.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function orderedNextSteps(item: Opportunity, items: Opportunity[], edges: PathwayEdge[]): PathwayStep[] {
  return pathwayStepsFor(item, items, edges).filter((step) => step.direction === "next");
}
