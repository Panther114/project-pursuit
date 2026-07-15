export type Confidence =
  | "verified"
  | "partially_verified"
  | "historical_information_only"
  | "unverified"
  | "needs_review";

export type OpportunityFormat = "online" | "in_person" | "hybrid" | "contact_instructor" | "unknown";
export type RegionTier = "shanghai_local" | "mainland_china" | "greater_china" | "china_participation_route" | "international_only";
export type CurrentCycleStatus = "open" | "upcoming" | "closed" | "rolling" | "unknown";
export type PublicationStatus = "official_verified" | "corroborated" | "partially_verified" | "historical" | "unverified";
export type AudienceScope = "global_open" | "international_selection" | "regional_open" | "national_only" | "unknown";
export type EvidenceAuthority = "official" | "school" | "government" | "reputable_secondary" | "historical";
export type FieldEvidenceStatus = "official" | "corroborated" | "single_source" | "historical" | "missing";

export interface EvidenceReference {
  evidence_id: string;
  url?: string;
  publisher: string;
  authority: EvidenceAuthority;
  retrieved_at?: string;
  source_id?: string;
  note?: string;
}

export interface FieldEvidence {
  status: FieldEvidenceStatus;
  evidence_ids: string[];
}

export interface OpportunitySource {
  source_file: string;
  source_type: "xlsx" | "pdf" | "web_snapshot" | "web_reference";
  page_or_sheet: string;
  row_or_text_ref: string;
  raw_excerpt: string;
  extracted_at: string;
  source_id?: string;
  original_url?: string;
  snapshot_path?: string;
  retrieved_at?: string;
  content_hash?: string;
  extraction_locator?: string;
}

export interface Opportunity {
  id: string;
  canonical_name: string;
  aliases?: string[];
  name_zh?: string;
  name_en?: string;
  type: "competition" | "summer_program" | "research_program" | "other";
  subject_tags: string[];
  category?: string;
  region?: string;
  region_tier?: RegionTier;
  audience_scope?: AudienceScope;
  entry_pathway?: string;
  /** How a student typically enters: official direct, school channel, China partner, or national selection. */
  route_type?: "official" | "school" | "china_partner" | "national_selection" | "unknown";
  organizer?: string;
  country?: string;
  city?: string;
  format: OpportunityFormat;
  date_text?: string;
  deadline_text?: string;
  deadline_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  current_cycle_status?: CurrentCycleStatus;
  eligibility_text?: string;
  eligible_grades?: string[];
  eligible_ages?: string;
  eligible_curricula?: string[];
  languages?: string[];
  team_mode?: "individual" | "team" | "either" | "unknown";
  duration_text?: string;
  website_url?: string;
  registration_contact?: string;
  instructor_contact?: string;
  preparation?: string;
  description?: string;
  cost_text?: string;
  cost_amount?: number | null;
  cost_currency?: string;
  time_commitment?: "low" | "medium" | "high" | "unknown";
  difficulty_level?: string;
  recognition_level?: string;
  admissions_relevance_notes?: string;
  confidence: Confidence;
  last_verified_at?: string | null;
  verification_note?: string;
  publication_status?: PublicationStatus;
  evidence?: EvidenceReference[];
  field_evidence?: Record<string, FieldEvidence>;
  sources: OpportunitySource[];
}
