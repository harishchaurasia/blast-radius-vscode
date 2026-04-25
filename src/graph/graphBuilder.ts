import { CallGraph, FunctionNode, ParseResult } from "../types";

/**
 * Build a CallGraph from parsed nodes and edges.
 *
 * - Deduplicates nodes by ID (`filePath#symbolName`); last-seen wins for metadata.
 * - Builds forward adjacency (caller → callees) and reverse adjacency (callee → callers).
 * - Only includes edges where both caller and callee exist in `nodes`.
 * - Maintains graph invariants: no duplicate nodes, referential integrity,
 *   forward/reverse symmetry (including self-edges for recursive functions).
 */
export function buildGraph(parseResult: ParseResult): CallGraph {
  const nodes = new Map<string, FunctionNode>();
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  // 1. Populate nodes — last-seen wins for metadata
  for (const node of parseResult.nodes) {
    nodes.set(node.id, node);
  }

  // 2. Initialize adjacency sets for every node
  for (const id of nodes.keys()) {
    forward.set(id, new Set<string>());
    reverse.set(id, new Set<string>());
  }

  // 3. Process edges — only include edges where both endpoints exist in nodes
  for (const edge of parseResult.edges) {
    if (nodes.has(edge.callerId) && nodes.has(edge.calleeId)) {
      forward.get(edge.callerId)!.add(edge.calleeId);
      reverse.get(edge.calleeId)!.add(edge.callerId);
    }
  }

  return { nodes, forward, reverse };
}
