import * as assert from "assert";
import { buildGraph } from "../../graph/graphBuilder";
import type { FunctionNode, ParseResult } from "../../types";

/**
 * Unit tests for the Graph Builder (buildGraph).
 */
suite("Graph Builder", () => {
  // Helper to create a FunctionNode
  function node(id: string, kind: "function" | "arrow" | "method" = "function"): FunctionNode {
    const [filePath, symbolName] = id.split("#");
    return { id, filePath, symbolName, startLine: 1, endLine: 5, kind };
  }

  // -----------------------------------------------------------------------
  // Deduplication
  // -----------------------------------------------------------------------

  test("deduplicates nodes with same ID (last-seen wins)", () => {
    const input: ParseResult = {
      nodes: [
        { id: "a.ts#foo", filePath: "a.ts", symbolName: "foo", startLine: 1, endLine: 5, kind: "function" },
        { id: "a.ts#foo", filePath: "a.ts", symbolName: "foo", startLine: 10, endLine: 20, kind: "function" },
      ],
      edges: [],
    };

    const graph = buildGraph(input);

    assert.strictEqual(graph.nodes.size, 1, "should have exactly 1 node after dedup");
    assert.strictEqual(graph.nodes.get("a.ts#foo")!.startLine, 10, "last-seen should win");
  });

  // -----------------------------------------------------------------------
  // Forward and reverse adjacency
  // -----------------------------------------------------------------------

  test("builds forward and reverse adjacency correctly", () => {
    const input: ParseResult = {
      nodes: [node("a.ts#caller"), node("a.ts#callee")],
      edges: [{ callerId: "a.ts#caller", calleeId: "a.ts#callee" }],
    };

    const graph = buildGraph(input);

    // Forward: caller -> callee
    assert.ok(graph.forward.get("a.ts#caller")!.has("a.ts#callee"), "forward should contain edge");
    assert.strictEqual(graph.forward.get("a.ts#callee")!.size, 0, "callee should have no forward edges");

    // Reverse: callee -> caller
    assert.ok(graph.reverse.get("a.ts#callee")!.has("a.ts#caller"), "reverse should contain edge");
    assert.strictEqual(graph.reverse.get("a.ts#caller")!.size, 0, "caller should have no reverse edges");
  });

  // -----------------------------------------------------------------------
  // Referential integrity
  // -----------------------------------------------------------------------

  test("excludes edges referencing unknown nodes", () => {
    const input: ParseResult = {
      nodes: [node("a.ts#known")],
      edges: [
        { callerId: "a.ts#known", calleeId: "a.ts#unknown" },
        { callerId: "a.ts#ghost", calleeId: "a.ts#known" },
      ],
    };

    const graph = buildGraph(input);

    assert.strictEqual(graph.forward.get("a.ts#known")!.size, 0, "should not include edge to unknown node");
    assert.strictEqual(graph.reverse.get("a.ts#known")!.size, 0, "should not include edge from unknown node");
  });

  // -----------------------------------------------------------------------
  // Forward/reverse symmetry
  // -----------------------------------------------------------------------

  test("maintains forward/reverse symmetry", () => {
    const input: ParseResult = {
      nodes: [node("a.ts#a"), node("a.ts#b"), node("a.ts#c")],
      edges: [
        { callerId: "a.ts#a", calleeId: "a.ts#b" },
        { callerId: "a.ts#b", calleeId: "a.ts#c" },
        { callerId: "a.ts#a", calleeId: "a.ts#c" },
      ],
    };

    const graph = buildGraph(input);

    // For every forward edge, there must be a corresponding reverse edge
    for (const [callerId, callees] of graph.forward) {
      for (const calleeId of callees) {
        assert.ok(
          graph.reverse.get(calleeId)!.has(callerId),
          `reverse should contain ${calleeId} -> ${callerId}`,
        );
      }
    }

    // For every reverse edge, there must be a corresponding forward edge
    for (const [calleeId, callers] of graph.reverse) {
      for (const callerId of callers) {
        assert.ok(
          graph.forward.get(callerId)!.has(calleeId),
          `forward should contain ${callerId} -> ${calleeId}`,
        );
      }
    }
  });

  // -----------------------------------------------------------------------
  // Self-edges (recursive functions)
  // -----------------------------------------------------------------------

  test("preserves self-edges for recursive functions", () => {
    const input: ParseResult = {
      nodes: [node("a.ts#recurse")],
      edges: [{ callerId: "a.ts#recurse", calleeId: "a.ts#recurse" }],
    };

    const graph = buildGraph(input);

    assert.ok(
      graph.forward.get("a.ts#recurse")!.has("a.ts#recurse"),
      "forward should contain self-edge",
    );
    assert.ok(
      graph.reverse.get("a.ts#recurse")!.has("a.ts#recurse"),
      "reverse should contain self-edge",
    );
  });

  // -----------------------------------------------------------------------
  // Empty input
  // -----------------------------------------------------------------------

  test("empty input produces empty graph", () => {
    const input: ParseResult = { nodes: [], edges: [] };
    const graph = buildGraph(input);

    assert.strictEqual(graph.nodes.size, 0);
    assert.strictEqual(graph.forward.size, 0);
    assert.strictEqual(graph.reverse.size, 0);
  });
});
