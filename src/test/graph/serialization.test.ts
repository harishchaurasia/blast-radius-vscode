import * as assert from "assert";
import {
  serializeCallGraph,
  serializeTestMap,
  deserializeCallGraph,
} from "../../graph/serialization";
import type { CallGraph, FunctionNode, TestMap } from "../../types";

/**
 * Unit tests for serialization round-trip (serializeCallGraph,
 * deserializeCallGraph, serializeTestMap).
 */
suite("Serialization", () => {
  function node(id: string, kind: "function" | "arrow" | "method" = "function"): FunctionNode {
    const [filePath, symbolName] = id.split("#");
    return { id, filePath, symbolName, startLine: 1, endLine: 10, kind };
  }

  function makeGraph(
    nodeIds: string[],
    edgePairs: [string, string][],
  ): CallGraph {
    const nodes = new Map<string, FunctionNode>();
    const forward = new Map<string, Set<string>>();
    const reverse = new Map<string, Set<string>>();

    for (const id of nodeIds) {
      nodes.set(id, node(id));
      forward.set(id, new Set());
      reverse.set(id, new Set());
    }

    for (const [from, to] of edgePairs) {
      forward.get(from)!.add(to);
      reverse.get(to)!.add(from);
    }

    return { nodes, forward, reverse };
  }

  // -----------------------------------------------------------------------
  // Round-trip: serialize -> deserialize produces same nodes and edges
  // -----------------------------------------------------------------------

  test("serialize then deserialize produces the same nodes and edges", () => {
    const graph = makeGraph(
      ["src/a.ts#foo", "src/b.ts#bar", "src/b.ts#baz"],
      [
        ["src/a.ts#foo", "src/b.ts#bar"],
        ["src/b.ts#bar", "src/b.ts#baz"],
      ],
    );

    const serialized = serializeCallGraph(graph);
    const deserialized = deserializeCallGraph(serialized);

    // Same node IDs
    const originalIds = Array.from(graph.nodes.keys()).sort();
    const roundTripIds = deserialized.nodes.map((n) => n.id).sort();
    assert.deepStrictEqual(roundTripIds, originalIds, "node IDs should match after round-trip");

    // Same edges
    const originalEdges = serialized.edges
      .map((e) => `${e.callerId}->${e.calleeId}`)
      .sort();
    const roundTripEdges = deserialized.edges
      .map((e) => `${e.callerId}->${e.calleeId}`)
      .sort();
    assert.deepStrictEqual(roundTripEdges, originalEdges, "edges should match after round-trip");
  });

  // -----------------------------------------------------------------------
  // Empty graph round-trip
  // -----------------------------------------------------------------------

  test("empty graph round-trip", () => {
    const graph = makeGraph([], []);

    const serialized = serializeCallGraph(graph);
    const deserialized = deserializeCallGraph(serialized);

    assert.strictEqual(deserialized.nodes.length, 0, "should have no nodes");
    assert.strictEqual(deserialized.edges.length, 0, "should have no edges");
  });

  // -----------------------------------------------------------------------
  // Self-edges (recursive functions)
  // -----------------------------------------------------------------------

  test("graph with self-edges round-trips correctly", () => {
    const graph = makeGraph(
      ["src/rec.ts#recurse"],
      [["src/rec.ts#recurse", "src/rec.ts#recurse"]],
    );

    const serialized = serializeCallGraph(graph);
    const deserialized = deserializeCallGraph(serialized);

    assert.strictEqual(deserialized.nodes.length, 1);
    assert.strictEqual(deserialized.edges.length, 1);

    const edge = deserialized.edges[0];
    assert.strictEqual(edge.callerId, "src/rec.ts#recurse");
    assert.strictEqual(edge.calleeId, "src/rec.ts#recurse");
  });

  // -----------------------------------------------------------------------
  // Node metadata preserved
  // -----------------------------------------------------------------------

  test("node metadata is preserved through serialization", () => {
    const graph = makeGraph(["src/x.ts#myFunc"], []);
    // Override with specific metadata
    graph.nodes.set("src/x.ts#myFunc", {
      id: "src/x.ts#myFunc",
      filePath: "src/x.ts",
      symbolName: "myFunc",
      startLine: 5,
      endLine: 15,
      kind: "arrow",
    });

    const serialized = serializeCallGraph(graph);
    const deserialized = deserializeCallGraph(serialized);

    const n = deserialized.nodes[0];
    assert.strictEqual(n.id, "src/x.ts#myFunc");
    assert.strictEqual(n.filePath, "src/x.ts");
    assert.strictEqual(n.symbolName, "myFunc");
    assert.strictEqual(n.startLine, 5);
    assert.strictEqual(n.endLine, 15);
    assert.strictEqual(n.kind, "arrow");
  });

  // -----------------------------------------------------------------------
  // TestMap serialization
  // -----------------------------------------------------------------------

  test("serializeTestMap converts mapping to entries array", () => {
    const testMap: TestMap = {
      mapping: new Map([
        ["src/test/a.test.ts", new Set(["src/a.ts#foo", "src/a.ts#bar"])],
        ["src/test/b.test.ts", new Set(["src/b.ts#baz"])],
      ]),
    };

    const serialized = serializeTestMap(testMap);

    assert.strictEqual(serialized.entries.length, 2);

    const entryA = serialized.entries.find((e) => e.testFile === "src/test/a.test.ts");
    assert.ok(entryA, "should have entry for a.test.ts");
    assert.deepStrictEqual(
      entryA!.functionNodeIds.sort(),
      ["src/a.ts#bar", "src/a.ts#foo"],
    );

    const entryB = serialized.entries.find((e) => e.testFile === "src/test/b.test.ts");
    assert.ok(entryB, "should have entry for b.test.ts");
    assert.deepStrictEqual(entryB!.functionNodeIds, ["src/b.ts#baz"]);
  });
});
