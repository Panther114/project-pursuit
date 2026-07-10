import { describe, expect, it } from "vitest";
import { revealDelay } from "./reveal";

describe("revealDelay", () => {
  it("staggers a group of rows and restarts at the next group", () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(5)).toBe(225);
    expect(revealDelay(6)).toBe(0);
  });
});
