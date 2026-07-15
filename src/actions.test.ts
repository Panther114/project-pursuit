import { describe, expect, it } from "vitest";
import { opportunities } from "./data";
import { pathwayEdges } from "./data/pathway-edges";
import { buildActionPack, buildShortlistActionPack } from "./actions";
import { findOpportunityByName } from "./pathway";

describe("action packs", () => {
  it("surfaces registration or prep signals when available", () => {
    const usaco = findOpportunityByName(opportunities, "USACO") ?? opportunities.find((item) => item.type === "competition" && item.website_url);
    expect(usaco).toBeTruthy();
    const pack = buildActionPack(usaco!, opportunities, pathwayEdges);
    expect(pack.actions.length).toBeGreaterThan(0);
    expect(pack.actions.some((action) => action.kind === "register" || action.kind === "verify")).toBe(true);
    if (usaco!.website_url) {
      const register = pack.actions.find((action) => action.kind === "register");
      expect(register?.href).toBe(usaco!.website_url);
    }
    if (usaco!.preparation || usaco!.time_commitment) {
      expect(pack.actions.some((action) => action.kind === "prepare")).toBe(true);
    }
  });

  it("includes pathway next-step actions for AMC", () => {
    const amc = findOpportunityByName(opportunities, "American Mathematics Competitions");
    expect(amc).toBeTruthy();
    const pack = buildActionPack(amc!, opportunities, pathwayEdges);
    expect(pack.pathway.length).toBeGreaterThan(0);
    expect(pack.actions.some((action) => action.kind === "pathway")).toBe(true);
  });

  it("builds shortlist packs for multiple saved competitions", () => {
    const sample = opportunities.filter((item) => item.type === "competition").slice(0, 3);
    const packs = buildShortlistActionPack(sample, opportunities, pathwayEdges);
    expect(packs).toHaveLength(3);
    expect(packs.every((pack) => pack.actions.length > 0)).toBe(true);
  });
});
