import type {
  CallGraph,
  SerializedCallGraph,
  SerializedCallEdge,
  SerializedFunctionNode,
  SerializedTestMap,
  TestMap,
} from "../types";

/**
 * Serialize a CallGraph into a JSON-safe representation for transmission
 * via the VSCode postMessage API.
 *
 * Converts:
 *   - `nodes` Map  → array of SerializedFunctionNode
 *   - `forward` adjacency Map<string, Set<string>> → array of SerializedCallEdge
 *     (one edge per caller→callee pair; reverse is derived on the other side)
 *
 * Round-trip guarantee: serializeCallGraph → deserializeCallGraph produces
 * the same set of nodes and edges as the original graph.
 */
export function serializeCallGraph(graph: CallGraph): SerializedCallGraph {
  // Nodes: Map values → array
  const nodes: SerializedFunctionNode[] = Array.from(graph.nodes.values()).map(
    (n) => ({
      id: n.id,
      filePath: n.filePath,
      symbolName: n.symbolName,
      startLine: n.startLine,
      endLine: n.endLine,
      kind: n.kind,
    }),
  );

  // Edges: derive from forward adjacency map
  const edges: SerializedCallEdge[] = [];
  for (const [callerId, calleeSet] of graph.forward) {
    for (const calleeId of calleeSet) {
      edges.push({ callerId, calleeId });
    }
  }

  return { nodes, edges };
}

/**
 * Serialize a TestMap into a JSON-safe representation.
 *
 * Converts the `mapping` Map<string, Set<string>> into an array of
 * `{ testFile, functionNodeIds }` entries.
 */
export function serializeTestMap(testMap: TestMap): SerializedTestMap {
  const entries = Array.from(testMap.mapping.entries()).map(
    ([testFile, nodeIdSet]) => ({
      testFile,
      functionNodeIds: Array.from(nodeIdSet),
    }),
  );
  return { entries };
}

/**
 * Deserialize a SerializedCallGraph back into flat node and edge arrays
 * for use in the webview client (Cytoscape.js).
 *
 * Returns the same shape as SerializedCallGraph — the webview does not need
 * the full Map-based CallGraph; it works directly with arrays.
 */
export function deserializeCallGraph(serialized: SerializedCallGraph): {
  nodes: SerializedFunctionNode[];
  edges: SerializedCallEdge[];
} {
  return {
    nodes: serialized.nodes.map((n) => ({ ...n })),
    edges: serialized.edges.map((e) => ({ ...e })),
  };
}
