import type { Opportunity } from "./types";

export type AppRoute = "home" | "competitions" | "programs" | "dreams";
export type CatalogKind = "competition" | "program";

export function routeFromPathname(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/competitions") return "competitions";
  if (normalized === "/programs") return "programs";
  if (normalized === "/dreams") return "dreams";
  return "home";
}

export function pathForRoute(route: AppRoute): string {
  return route === "home" ? "/" : `/${route}`;
}

export function getCatalogItems(items: Opportunity[], kind: CatalogKind): Opportunity[] {
  return items.filter((item) => (kind === "competition" ? item.type === "competition" : item.type !== "competition"));
}

export function getReviewReason(item: Opportunity): string | null {
  if (!item.website_url) return "Official organizer page is missing.";
  if (!item.last_verified_at) return "Official organizer page has not been checked.";
  if (!item.deadline_text || !/\d{4}/.test(item.deadline_text)) return "Current-cycle deadline still needs confirmation.";
  return null;
}
