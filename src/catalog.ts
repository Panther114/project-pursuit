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
