import type { Opportunity } from "./types";
import { orderedNextSteps, type PathwayEdge, type PathwayStep } from "./pathway";

export type ActionItem = {
  kind: "register" | "prepare" | "verify" | "pathway" | "deadline" | "cost" | "school";
  title: string;
  detail: string;
  href?: string;
};

export type ActionPack = {
  opportunity: Opportunity;
  actions: ActionItem[];
  pathway: PathwayStep[];
};

export function buildActionPack(item: Opportunity, all: Opportunity[] = [], edges: PathwayEdge[] = []): ActionPack {
  const actions: ActionItem[] = [];
  if (item.website_url) {
    actions.push({
      kind: "register",
      title: "Open official / source website",
      detail: "Confirm current-cycle registration instructions on the organizer page before paying or submitting.",
      href: item.website_url
    });
  } else {
    actions.push({
      kind: "verify",
      title: "Locate official registration channel",
      detail: "No website is stored yet. Ask your school coordinator or search the organizer name before acting."
    });
  }

  if (item.entry_pathway) {
    actions.push({
      kind: "school",
      title: "Follow the published entry pathway",
      detail: item.entry_pathway
    });
  }

  if (item.deadline_date || item.deadline_text || (item.current_cycle_status && item.current_cycle_status !== "unknown")) {
    actions.push({
      kind: "deadline",
      title: "Track deadline / cycle signal",
      detail: [item.deadline_date, item.deadline_text, item.current_cycle_status ? `status: ${item.current_cycle_status}` : ""]
        .filter(Boolean)
        .join(" · ")
    });
  } else {
    actions.push({
      kind: "verify",
      title: "Deadline not published in catalog",
      detail: "Treat timing as uncertain until an official page is checked for this cycle."
    });
  }

  if (item.preparation) {
    actions.push({ kind: "prepare", title: "Preparation cue", detail: item.preparation });
  } else if (item.time_commitment && item.time_commitment !== "unknown") {
    actions.push({
      kind: "prepare",
      title: "Plan preparation time",
      detail: `Catalog time commitment is ${item.time_commitment}. Build a multi-week practice plan before the contest window.`
    });
  }

  if (item.cost_text || item.cost_amount != null) {
    actions.push({
      kind: "cost",
      title: "Budget for published cost signal",
      detail: item.cost_amount != null
        ? `${item.cost_amount}${item.cost_currency ? ` ${item.cost_currency}` : ""}${item.cost_text ? ` — ${item.cost_text}` : ""}`
        : String(item.cost_text)
    });
  }

  if (item.verification_note) {
    actions.push({ kind: "verify", title: "Respect verification limits", detail: item.verification_note });
  }

  const pathway = orderedNextSteps(item, all, edges);
  for (const step of pathway) {
    actions.push({
      kind: "pathway",
      title: `Next pathway step: ${step.opportunity.canonical_name}`,
      detail: `${step.relation}${step.note ? ` — ${step.note}` : ""}`
    });
  }

  return { opportunity: item, actions, pathway };
}

export function buildShortlistActionPack(items: Opportunity[], all: Opportunity[] = [], edges: PathwayEdge[] = []): ActionPack[] {
  return items.filter((item) => item.type === "competition").map((item) => buildActionPack(item, all, edges));
}
