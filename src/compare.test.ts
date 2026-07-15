import { describe, expect, it } from "vitest";
import { opportunities } from "./data";
import { compareCompetitions } from "./compare";

describe("compareCompetitions", () => {
  it("builds field-aligned factual rows with missing markers", () => {
    const comps = opportunities.filter((item) => item.type === "competition").slice(0, 3);
    const table = compareCompetitions(comps);
    expect(table.items).toHaveLength(3);
    expect(table.rows.length).toBeGreaterThan(8);
    const deadline = table.rows.find((row) => row.field === "deadline");
    expect(deadline).toBeTruthy();
    expect(deadline!.cells).toHaveLength(3);
    for (const row of table.rows) {
      expect(row.cells).toHaveLength(table.items.length);
      for (const cell of row.cells) {
        expect(typeof cell.value).toBe("string");
        expect(typeof cell.missing).toBe("boolean");
        if (cell.missing) expect(cell.value.toLowerCase()).toMatch(/missing|not published/);
      }
    }
  });

  it("caps comparison at four competitions", () => {
    const comps = opportunities.filter((item) => item.type === "competition").slice(0, 6);
    const table = compareCompetitions(comps);
    expect(table.items.length).toBeLessThanOrEqual(4);
  });
});
