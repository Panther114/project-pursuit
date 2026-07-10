import { describe, expect, it } from "vitest";
import { opportunities } from ".";

describe("competition verification overlay", () => {
  it("attaches a current organizer URL and review date to every competition", () => {
    const competitions = opportunities.filter((item) => item.type === "competition");

    expect(competitions).toHaveLength(14);
    expect(competitions.every((item) => item.website_url?.startsWith("https://") && item.last_verified_at && item.verification_note)).toBe(true);
  });
});
