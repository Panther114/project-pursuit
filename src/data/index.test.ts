import { describe, expect, it } from "vitest";
import { opportunities } from ".";

describe("generated opportunity catalog", () => {
  it("retains school competitions and source traceability", () => {
    expect(opportunities.filter((item) => item.type === "competition").length).toBeGreaterThanOrEqual(14);
    expect(opportunities.every((item) => item.sources.length > 0)).toBe(true);
  });

  it("provides complete provenance for every official web record", () => {
    const online = opportunities.filter((item) => item.sources.some((source) => source.source_type === "web_snapshot"));
    expect(online.length).toBeGreaterThan(0);
    expect(online.every((item) => item.website_url?.startsWith("https://") && item.last_verified_at)).toBe(true);
    expect(online.flatMap((item) => item.sources).filter((source) => source.source_type === "web_snapshot").every((source) => source.source_id && source.original_url)).toBe(true);
  });

  it("never publishes an officially verified identity without retained web evidence", () => {
    const official = opportunities.filter((item) => item.publication_status === "official_verified");
    expect(official.length).toBeGreaterThan(0);
    expect(official.every((item) => item.sources.some((source) => source.source_type === "web_snapshot" && source.source_id && source.original_url))).toBe(true);
  });
});
