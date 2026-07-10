import { describe, expect, it } from "vitest";
import { nextOptionIndex } from "./custom-select";

describe("nextOptionIndex", () => {
  it("wraps keyboard navigation through the available menu options", () => {
    expect(nextOptionIndex(0, 3, "previous")).toBe(2);
    expect(nextOptionIndex(2, 3, "next")).toBe(0);
  });
});
