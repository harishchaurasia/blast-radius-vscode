import { ParseResult, CallGraph, FunctionNode } from "../types";

export function buildGraph(parseResult: ParseResult): CallGraph {
  const nodes = new Map<string, FunctionNode>();
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  for (const node of parseResult.nodes) {
    nodes.set(node.id, node);
  }

  for (const edge of parseResult.edges) {
    if (!nodes.has(edge.callerId) || !nodes.has(edge.calleeId)) {
      continue;
    }

    if (!forward.has(edge.callerId)) {
      forward.set(edge.callerId, new Set());
    }
    forward.get(edge.callerId)!.add(edge.calleeId);

    if (!reverse.has(edge.calleeId)) {
      reverse.set(edge.calleeId, new Set());
    }
    reverse.get(edge.calleeId)!.add(edge.callerId);
  }

  return { nodes, forward, reverse };
}
