export type Confidence =
  | "verified"
  | "partially_verified"
  | "historical_information_only"
  | "unverified"
  | "needs_review";

export type OpportunityFormat = "online" | "in_person" | "hybrid" | "contact_instructor" | "unknown";

export interface OpportunitySource {
  source_file: string;
  source_type: "xlsx" | "pdf";
  page_or_sheet: string;
  row_or_text_ref: string;
  raw_excerpt: string;
  extracted_at: string;
}

export interface Opportunity {
  id: string;
  canonical_name: string;
  name_zh?: string;
  name_en?: string;
  type: "competition" | "summer_program" | "research_program" | "other";
  subject_tags: string[];
  category?: string;
  region?: string;
  format: OpportunityFormat;
  date_text?: string;
  deadline_text?: string;
  deadline_date?: string | null;
  eligibility_text?: string;
  duration_text?: string;
  website_url?: string;
  registration_contact?: string;
  instructor_contact?: string;
  preparation?: string;
  description?: string;
  cost_text?: string;
  difficulty_level?: string;
  recognition_level?: string;
  admissions_relevance_notes?: string;
  confidence: Confidence;
  last_verified_at?: string | null;
  sources: OpportunitySource[];
}

export interface Preferences {
  grade: string;
  subjects: string[];
  format: "any" | OpportunityFormat;
  horizon: "any" | "30" | "90" | "180";
  goal: "any" | "research" | "olympiad" | "writing" | "business" | "summer";
}

export interface FitResult {
  score: number;
  label: string;
  reasons: string[];
  cautions: string[];
}
