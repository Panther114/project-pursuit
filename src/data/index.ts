import generated from "./opportunities.generated.json";
import type { Opportunity } from "../types";

export const generatedAt = generated.generated_at;
export const opportunities = generated.records as Opportunity[];
