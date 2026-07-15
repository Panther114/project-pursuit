import generated from "./pathway-edges.generated.json";
import type { PathwayEdge } from "../pathway";

export const pathwayEdges = (generated as { edges: PathwayEdge[] }).edges;
