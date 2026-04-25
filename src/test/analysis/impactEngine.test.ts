import * as assert from "assert";
import { computeBlastRadius } from "../../analysis/impactEngine";
import type { CallGraph, FunctionNode, TestMap } from "../../types";

/**
 * Unit tests for the Impact Engine (computeBlastRadius).
 */
suite("Impact Engine", () => {
  // Helper to create a FunctionNode
  function node(id: string): FunctionNode {
    const [filePath, symbolName] = id.split("#");
    return { id, filePath, symbolName, startLine: 1, endLine: 5, kind: "function" };
  }

  // Helper to build a CallGraph from node IDs and edge pairs
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

  // Helper to build a TestMap
  function makeTestMap(entries: [string, string[]][]): TestMap {
    const mapping = new Map<string, Set<string>>();
    for (const [testFile, nodeIds] of entries) {
      mapping.set(testFile, new Set(nodeIds));
    }
    return { mapping };
  }

  // -----------------------------------------------------------------------
  // Downstream BFS
  // -----------------------------------------------------------------------

  test("computes downstream nodes via forward BFS", () => {
    // a -> b -> c
    const graph = makeGraph(
      ["src/mod/a.ts#a", "src/mod/b.ts#b", "src/mod/c.ts#c"],
      [
        ["src/mod/a.ts#a", "src/mod/b.ts#b"],
        ["src/mod/b.ts#b", "src/mod/c.ts#c"],
      ],
    );
    const testMap = makeTestMap([]);

    const result = computeBlastRadius("src/mod/a.ts#a", graph, testMap);

    assert.ok(result.downstream.has("src/mod/b.ts#b"), "should include direct callee b");
    assert.ok(result.downstream.has("src/mod/c.ts#c"), "should include transitive callee c");
    assert.strictEqual(result.downstream.size, 2);
  });

  // -----------------------------------------------------------------------
  // Upstream BFS
  // -----------------------------------------------------------------------

  test("computes upstream nodes via reverse BFS", () => {
    // a -> b -> c; query from c
    const graph = makeGraph(
      ["src/mod/a.ts#a", "src/mod/b.ts#b", "src/mod/c.ts#c"],
      [
        ["src/mod/a.ts#a", "src/mod/b.ts#b"],
        ["src/mod/b.ts#b", "src/mod/c.ts#c"],
      ],
    );
    const testMap = makeTestMap([]);

    const result = computeBlastRadius("src/mod/c.ts#c", graph, testMap);

    assert.ok(result.upstream.has("src/mod/b.ts#b"), "should include direct caller b");
    assert.ok(result.upstream.has("src/mod/a.ts#a"), "should include transitive caller a");
    assert.strictEqual(result.upstream.size, 2);
  });

  // -----------------------------------------------------------------------
  // Linked tests
  // -----------------------------------------------------------------------

  test("identifies linked test files", () => {
    const graph = makeGraph(["src/mod/a.ts#a", "src/mod/b.ts#b"], []);
    const testMap = makeTestMap([
      ["src/test/a.test.ts", ["src/mod/a.ts#a", "src/mod/b.ts#b"]],
      ["src/test/b.test.ts", ["src/mod/b.ts#b"]],
      ["src/test/c.test.ts", ["src/mod/c.ts#c"]],
    ]);

    const result = computeBlastRadius("src/mod/a.ts#a", graph, testMap);

    assert.deepStrictEqual(
      result.linkedTests.sort(),
      ["src/test/a.test.ts"],
      "should include only test files covering the selected node",
    );
  });

  // -----------------------------------------------------------------------
  // Feature module inference
  // -----------------------------------------------------------------------

  test("infers feature modules from affected node file paths", () => {
    // a -> b (in cart/), a -> c (in utils/)
    const graph = makeGraph(
      ["src/core/a.ts#a", "src/cart/b.ts#b", "src/utils/c.ts#c"],
      [
        ["src/core/a.ts#a", "src/cart/b.ts#b"],
        ["src/core/a.ts#a", "src/utils/c.ts#c"],
      ],
    );
    const testMap = makeTestMap([]);

    const result = computeBlastRadius("src/core/a.ts#a", graph, testMap);

    assert.ok(result.affectedModules.includes("cart"), "should include cart module");
    assert.ok(result.affectedModules.includes("utils"), "should include utils module");
  });

  // -----------------------------------------------------------------------
  // Isolated node
  // -----------------------------------------------------------------------

  test("isolated node has empty upstream, downstream, and tests", () => {
    const graph = makeGraph(
      ["src/mod/lonely.ts#lonely", "src/mod/other.ts#other"],
      [],
    );
    const testMap = makeTestMap([]);

    const result = computeBlastRadius("src/mod/lonely.ts#lonely", graph, testMap);

    assert.strictEqual(result.downstream.size, 0, "no downstream");
    assert.strictEqual(result.upstream.size, 0, "no upstream");
    assert.strictEqual(result.linkedTests.length, 0, "no linked tests");
    assert.strictEqual(result.affectedCount, 0, "affected count should be 0");
  });

  // -----------------------------------------------------------------------
  // Affected count
  // -----------------------------------------------------------------------

  test("affected count is the size of upstream union downstream", () => {
    // x -> a -> b, c -> a (upstream of a: c, x; downstream of a: b)
    // Wait, let's be precise: a -> b (downstream), c -> a and x -> a (upstream)
    const graph = makeGraph(
      ["src/mod/x.ts#x", "src/mod/a.ts#a", "src/mod/b.ts#b", "src/mod/c.ts#c"],
      [
        ["src/mod/x.ts#x", "src/mod/a.ts#a"],
        ["src/mod/c.ts#c", "src/mod/a.ts#a"],
        ["src/mod/a.ts#a", "src/mod/b.ts#b"],
      ],
    );
    const testMap = makeTestMap([]);

    const result = computeBlastRadius("src/mod/a.ts#a", graph, testMap);

    // upstream: x, c; downstream: b => union size = 3
    assert.strictEqual(result.upstream.size, 2, "upstream should have x and c");
    assert.strictEqual(result.downstream.size, 1, "downstream should have b");
    assert.strictEqual(result.affectedCount, 3, "affected count = |upstream union downstream|");
  });
});
