import type { Opportunity } from "../types";

type CompetitionVerification = Pick<Opportunity, "website_url" | "last_verified_at" | "verification_note">;

const reviewedAt = "2026-07-10";
const note = "Official organizer identity and destination were checked on 2026-07-10. The SHSID schedule is historical or relative, so confirm the current-cycle deadline with the organizer.";

export const competitionVerification: Record<string, CompetitionVerification> = {
  "contest-american-mathematics-competition-shsid2024-2025-1st-semester-contests-and-activities": {
    website_url: "https://maa.org/student-programs/amc/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-annual-dna-day-essay-contest-shsid2024-2025-1st-semester-contests-and-activities": {
    website_url: "https://www.ashg.org/dna-day/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-brainbee-china-round-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://brainbee.org.cn/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-canadian-computing-competition-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://cemc.uwaterloo.ca/contests/ccc",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-canadian-senior-and-intermediate-mathematics-contests-shsid2024-2025-1st-semester-contests-and-activities": {
    website_url: "https://cemc.uwaterloo.ca/contests/csimc",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-chinese-earth-science-olympiad-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://ceso.ssoc.org.cn/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-csp-noip-shsid2024-2025-1st-semester-contests-and-activities": {
    website_url: "https://www.noi.cn/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-exporecerca-jove-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://magmarecerca.org/exporecerca/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-genius-olympiad-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://geniusolympiad.org/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-hong-kong-young-writer-s-awards-shsid2025-2026-1st-semester-contests-and-activities": {
    website_url: "https://www.hkywa.com/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-international-linguistics-olympiad-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://ioling.org/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-physics-bowl-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://www.aapt.org/Programs/PhysicsBowl/",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-us-national-chemistry-competition-usnco-shsid2024-2025-2nd-semester-contests-and-activities-2": {
    website_url: "https://www.acs.org/education/olympiad.html",
    last_verified_at: reviewedAt,
    verification_note: note
  },
  "contest-usaco-shsid2024-2025-1st-semester-contests-and-activities": {
    website_url: "https://usaco.org/",
    last_verified_at: reviewedAt,
    verification_note: note
  }
};
