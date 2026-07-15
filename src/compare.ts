import type { Opportunity } from "./types";

export type CompareCell = {
  value: string;
  missing: boolean;
};

export type CompareRow = {
  field: string;
  label: string;
  cells: CompareCell[];
};

export type CompareTable = {
  items: Opportunity[];
  rows: CompareRow[];
};

function cell(value: string | null | undefined): CompareCell {
  const text = (value ?? "").toString().trim();
  if (!text || text === "unknown" || text === "Not published") return { value: "Not published / missing", missing: true };
  return { value: text, missing: false };
}

function grades(item: Opportunity): string {
  const values = (item.eligible_grades ?? []).map(String);
  return values.length ? values.join(", ") : "";
}

function cost(item: Opportunity): string {
  if (item.cost_amount != null) return `${item.cost_amount}${item.cost_currency ? ` ${item.cost_currency}` : ""}${item.cost_text ? ` (${item.cost_text})` : ""}`;
  return item.cost_text ?? "";
}

function deadline(item: Opportunity): string {
  if (item.deadline_date) return item.deadline_date + (item.deadline_text ? ` · ${item.deadline_text}` : "");
  return item.deadline_text ?? "";
}

const FIELDS: Array<{ field: string; label: string; read: (item: Opportunity) => string }> = [
  { field: "canonical_name", label: "Name", read: (item) => item.canonical_name },
  { field: "name_zh", label: "Chinese name", read: (item) => item.name_zh ?? "" },
  { field: "organizer", label: "Organizer", read: (item) => item.organizer ?? "" },
  { field: "subject_tags", label: "Subjects", read: (item) => (item.subject_tags ?? []).join(", ") },
  { field: "region_tier", label: "Region tier", read: (item) => item.region_tier ?? "" },
  { field: "route_type", label: "Route type", read: (item) => (item as Opportunity & { route_type?: string }).route_type ?? "" },
  { field: "entry_pathway", label: "Entry pathway", read: (item) => item.entry_pathway ?? "" },
  { field: "audience_scope", label: "Access scope", read: (item) => item.audience_scope ?? "" },
  { field: "format", label: "Format", read: (item) => item.format },
  { field: "languages", label: "Languages", read: (item) => (item.languages ?? []).join(", ") },
  { field: "team_mode", label: "Team mode", read: (item) => item.team_mode ?? "" },
  { field: "eligible_grades", label: "Eligible grades", read: grades },
  { field: "deadline", label: "Deadline signal", read: deadline },
  { field: "current_cycle_status", label: "Cycle status", read: (item) => item.current_cycle_status ?? "" },
  { field: "cost", label: "Cost signal", read: cost },
  { field: "time_commitment", label: "Commitment", read: (item) => item.time_commitment ?? "" },
  { field: "website_url", label: "Website", read: (item) => item.website_url ?? "" },
  { field: "publication_status", label: "Source status", read: (item) => item.publication_status ?? item.confidence },
  { field: "verification_note", label: "Verification note", read: (item) => item.verification_note ?? "" }
];

export function compareCompetitions(items: Opportunity[]): CompareTable {
  const competitions = items.filter((item) => item.type === "competition").slice(0, 4);
  return {
    items: competitions,
    rows: FIELDS.map(({ field, label, read }) => ({
      field,
      label,
      cells: competitions.map((item) => cell(read(item)))
    }))
  };
}
