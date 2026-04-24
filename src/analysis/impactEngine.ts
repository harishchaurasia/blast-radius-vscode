import { CallGraph, TestMap, BlastRadiusResult } from "../types";

export function computeBlastRadius(
  nodeId: string,
  graph: CallGraph,
  testMap: TestMap
): BlastRadiusResult {
  const downstream = computeDownstream(nodeId, graph);
  const upstream = computeUpstream(nodeId, graph);
  const linkedTests = findLinkedTests(nodeId, testMap);
  const affectedModules = extractAffectedModules(nodeId, downstream, upstream, graph);
  const affectedCount = downstream.size + upstream.size;

  return {
    selectedNodeId: nodeId,
    downstream,
    upstream,
    linkedTests,
    affectedModules,
    affectedCount,
  };
}

function computeDownstream(nodeId: string, graph: CallGraph): Set<string> {
  const downstream = new Set<string>();
  const queue = [nodeId];
  const visited = new Set<string>([nodeId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const callees = graph.forward.get(current);

    if (callees) {
      for (const callee of callees) {
        if (!visited.has(callee)) {
          visited.add(callee);
          downstream.add(callee);
          queue.push(callee);
        }
      }
    }
  }

  return downstream;
}

function computeUpstream(nodeId: string, graph: CallGraph): Set<string> {
  const upstream = new Set<string>();
  const queue = [nodeId];
  const visited = new Set<string>([nodeId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const callers = graph.reverse.get(current);

    if (callers) {
      for (const caller of callers) {
        if (!visited.has(caller)) {
          visited.add(caller);
          upstream.add(caller);
          queue.push(caller);
        }
      }
    }
  }

  return upstream;
}

function findLinkedTests(nodeId: string, testMap: TestMap): string[] {
  const linkedTests: string[] = [];

  for (const [testFile, functionNodeIds] of testMap.mapping.entries()) {
    if (functionNodeIds.has(nodeId)) {
      linkedTests.push(testFile);
    }
  }

  return linkedTests;
}

function extractAffectedModules(
  nodeId: string,
  downstream: Set<string>,
  upstream: Set<string>,
  graph: CallGraph
): string[] {
  const modules = new Set<string>();
  const affectedNodeIds = new Set([nodeId, ...downstream, ...upstream]);

  for (const id of affectedNodeIds) {
    const node = graph.nodes.get(id);
    if (node) {
      const module = extractModuleName(node.filePath);
      if (module) {
        modules.add(module);
      }
    }
  }

  return Array.from(modules);
}

function extractModuleName(filePath: string): string | undefined {
  const parts = filePath.split("/");
  const srcIndex = parts.indexOf("src");
  
  if (srcIndex !== -1 && srcIndex + 1 < parts.length) {
    return parts[srcIndex + 1];
  }
  
  return undefined;
}
