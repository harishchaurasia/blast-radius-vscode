import type { BlastRadiusResult, CallGraph, TestMap } from "../types";

/**
 * Perform a BFS traversal over the given adjacency map starting from `startId`.
 * The start node itself is NOT included in the result set.
 */
function bfs(
  startId: string,
  adjacency: Map<string, Set<string>>,
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];

  const neighbors = adjacency.get(startId);
  if (neighbors) {
    for (const neighbor of neighbors) {
      if (neighbor !== startId && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentNeighbors = adjacency.get(current);
    if (currentNeighbors) {
      for (const neighbor of currentNeighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return visited;
}

/**
 * Extract the feature module name from a file path.
 * Returns the first path segment after `src/`, or null if the path does not
 * contain a segment after `src/`.
 *
 * Examples:
 *   `src/cart/calculateTotal.ts`  → `cart`
 *   `src/utils/math.ts`           → `utils`
 *   `src/index.ts`                → null  (file directly under src/, no sub-directory)
 */
function extractModule(filePath: string): string | null {
  // Normalise separators to forward slashes
  const normalised = filePath.replace(/\\/g, "/");

  // Match the segment immediately after `src/`
  const match = normalised.match(/(?:^|\/)src\/([^/]+)\//);
  if (!match) {
    return null;
  }
  return match[1];
}

/**
 * Compute the blast radius for a selected function node.
 *
 * - Downstream: BFS over `graph.forward` from `nodeId` (functions called by the selected node)
 * - Upstream:   BFS over `graph.reverse` from `nodeId` (functions that call the selected node)
 * - Linked tests: test files whose transitive coverage sets include `nodeId`
 * - Affected modules: deduplicated feature module names from all upstream + downstream node file paths
 * - Affected count: |upstream ∪ downstream|
 *
 * Must complete within 200 ms (Requirement 8.6).
 */
export function computeBlastRadius(
  nodeId: string,
  graph: CallGraph,
  testMap: TestMap,
): BlastRadiusResult {
  // --- Downstream: BFS over forward edges ---
  const downstream = bfs(nodeId, graph.forward);

  // --- Upstream: BFS over reverse edges ---
  const upstream = bfs(nodeId, graph.reverse);

  // --- Linked tests: test files whose coverage sets include nodeId ---
  const linkedTests: string[] = [];
  for (const [testFile, coveredNodes] of testMap.mapping) {
    if (coveredNodes.has(nodeId)) {
      linkedTests.push(testFile);
    }
  }

  // --- Affected modules: deduplicated feature modules from affected nodes ---
  const moduleSet = new Set<string>();
  const affectedNodeIds = new Set<string>([...upstream, ...downstream]);

  for (const affectedId of affectedNodeIds) {
    const node = graph.nodes.get(affectedId);
    if (node) {
      const mod = extractModule(node.filePath);
      if (mod !== null) {
        moduleSet.add(mod);
      }
    }
  }

  const affectedModules = Array.from(moduleSet).sort();

  // --- Affected count: |upstream ∪ downstream| ---
  const affectedCount = affectedNodeIds.size;

  return {
    selectedNodeId: nodeId,
    downstream,
    upstream,
    linkedTests,
    affectedModules,
    affectedCount,
  };
}
