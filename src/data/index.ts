import generated from "./opportunities.generated.json";
import type { Opportunity } from "../types";
import { competitionVerification } from "./competition-verification";

export const generatedAt = generated.generated_at;
export const opportunities = (generated.records as Opportunity[]).map((record) => ({
  ...record,
  ...competitionVerification[record.id]
}));
