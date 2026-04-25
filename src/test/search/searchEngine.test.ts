import * as assert from "assert";

// Import the plain JS search engine module
const {
  buildSearchIndex,
  fuzzyScore,
  fuzzySearch,
} = require("../../../media/searchEngine");

/**
 * Unit tests for the search engine module (media/searchEngine.js).
 * Covers buildSearchIndex, fuzzyScore, and fuzzySearch.
 */

// ---------------------------------------------------------------------------
// buildSearchIndex
// ---------------------------------------------------------------------------

suite("buildSearchIndex", () => {
  test("returns empty array for null/undefined input", () => {
    assert.deepStrictEqual(buildSearchIndex(null), []);
    assert.deepStrictEqual(buildSearchIndex(undefined), []);
  });

  test("returns empty array for empty graph data", () => {
    const result = buildSearchIndex({ nodes: [], testFiles: [], featureModules: [] });
    assert.strictEqual(result.length, 0);
  });

  test("indexes function nodes with correct fields", () => {
    const graphData = {
      nodes: [
        { id: "src/utils.ts#formatDate", symbolName: "formatDate", filePath: "src/utils.ts" },
      ],
      testFiles: [],
      featureModules: [],
    };
    const index = buildSearchIndex(graphData);
    assert.strictEqual(index.length, 1);
    const item = index[0];
    assert.strictEqual(item.id, "src/utils.ts#formatDate");
    assert.strictEqual(item.label, "formatDate");
    assert.strictEqual(item.secondaryLabel, "src/utils.ts");
    assert.strictEqual(item.category, "function");
    assert.strictEqual(item.labelLower, "formatdate");
    assert.strictEqual(item.secondaryLower, "src/utils.ts");
  });

  test("indexes test files with file name as label", () => {
    const graphData = {
      nodes: [],
      testFiles: [{ path: "src/test/auth/login.test.ts" }],
      featureModules: [],
    };
    const index = buildSearchIndex(graphData);
    assert.strictEqual(index.length, 1);
    const item = index[0];
    assert.strictEqual(item.id, "src/test/auth/login.test.ts");
    assert.strictEqual(item.label, "login.test.ts");
    assert.strictEqual(item.secondaryLabel, "src/test/auth/login.test.ts");
    assert.strictEqual(item.category, "test");
    assert.strictEqual(item.labelLower, "login.test.ts");
    assert.strictEqual(item.secondaryLower, "src/test/auth/login.test.ts");
  });

  test("indexes feature modules with module name as label", () => {
    const graphData = {
      nodes: [],
      testFiles: [],
      featureModules: ["auth"],
    };
    const index = buildSearchIndex(graphData);
    assert.strictEqual(index.length, 1);
    const item = index[0];
    assert.strictEqual(item.id, "auth");
    assert.strictEqual(item.label, "auth");
    assert.strictEqual(item.secondaryLabel, "");
    assert.strictEqual(item.category, "module");
    assert.strictEqual(item.labelLower, "auth");
    assert.strictEqual(item.secondaryLower, "");
  });

  test("total index length equals sum of all input arrays", () => {
    const graphData = {
      nodes: [
        { id: "a.ts#foo", symbolName: "foo", filePath: "a.ts" },
        { id: "b.ts#bar", symbolName: "bar", filePath: "b.ts" },
      ],
      testFiles: [{ path: "test/a.test.ts" }],
      featureModules: ["core", "auth"],
    };
    const index = buildSearchIndex(graphData);
    assert.strictEqual(index.length, 5);
  });

  test("handles missing arrays gracefully", () => {
    const index = buildSearchIndex({});
    assert.strictEqual(index.length, 0);
  });
});

// ---------------------------------------------------------------------------
// fuzzyScore
// ---------------------------------------------------------------------------

suite("fuzzyScore", () => {
  test("returns null for empty query", () => {
    assert.strictEqual(fuzzyScore("", "hello"), null);
  });

  test("returns null for empty text", () => {
    assert.strictEqual(fuzzyScore("hello", ""), null);
  });

  test("returns null when no match exists", () => {
    assert.strictEqual(fuzzyScore("xyz", "hello"), null);
  });

  test("prefix match scores highest (tier 3.0+)", () => {
    const result = fuzzyScore("hel", "hello");
    assert.ok(result !== null);
    assert.ok(result.score >= 3.0, `Expected score >= 3.0, got ${result.score}`);
    assert.deepStrictEqual(result.matches, [0, 1, 2]);
  });

  test("substring match scores in tier 2.0+", () => {
    const result = fuzzyScore("ell", "hello");
    assert.ok(result !== null);
    assert.ok(result.score >= 2.0 && result.score < 3.0, `Expected 2.0 <= score < 3.0, got ${result.score}`);
    assert.deepStrictEqual(result.matches, [1, 2, 3]);
  });

  test("subsequence match scores in tier 1.0+", () => {
    const result = fuzzyScore("hlo", "hello");
    assert.ok(result !== null);
    assert.ok(result.score >= 1.0 && result.score < 2.0, `Expected 1.0 <= score < 2.0, got ${result.score}`);
    assert.deepStrictEqual(result.matches, [0, 2, 4]);
  });

  test("matching is case-insensitive", () => {
    const lower = fuzzyScore("hel", "Hello");
    const upper = fuzzyScore("HEL", "Hello");
    assert.ok(lower !== null);
    assert.ok(upper !== null);
    assert.strictEqual(lower.score, upper.score);
  });

  test("exact match returns prefix tier score", () => {
    const result = fuzzyScore("hello", "hello");
    assert.ok(result !== null);
    // 3.0 + 5/5 = 4.0
    assert.strictEqual(result.score, 4.0);
    assert.deepStrictEqual(result.matches, [0, 1, 2, 3, 4]);
  });

  test("match indices are valid and ascending", () => {
    const result = fuzzyScore("fdb", "formatDateBold");
    assert.ok(result !== null);
    for (let i = 0; i < result.matches.length; i++) {
      assert.ok(result.matches[i] >= 0);
      assert.ok(result.matches[i] < "formatDateBold".length);
      if (i > 0) {
        assert.ok(result.matches[i] > result.matches[i - 1], "indices should be strictly ascending");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// fuzzySearch
// ---------------------------------------------------------------------------

suite("fuzzySearch", () => {
  function makeIndex() {
    return buildSearchIndex({
      nodes: [
        { id: "src/auth.ts#login", symbolName: "login", filePath: "src/auth.ts" },
        { id: "src/auth.ts#logout", symbolName: "logout", filePath: "src/auth.ts" },
        { id: "src/utils.ts#formatDate", symbolName: "formatDate", filePath: "src/utils.ts" },
      ],
      testFiles: [
        { path: "test/auth.test.ts" },
      ],
      featureModules: ["auth", "utils"],
    });
  }

  test("returns empty array for empty query", () => {
    const index = makeIndex();
    assert.deepStrictEqual(fuzzySearch("", index), []);
  });

  test("returns empty array for whitespace-only query", () => {
    const index = makeIndex();
    assert.deepStrictEqual(fuzzySearch("   ", index), []);
  });

  test("returns matching results with scores", () => {
    const index = makeIndex();
    const results = fuzzySearch("login", index);
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].item.label, "login");
    assert.ok(results[0].score > 0);
  });

  test("results are sorted by score descending", () => {
    const index = makeIndex();
    const results = fuzzySearch("log", index);
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1].score >= results[i].score,
        `Result ${i - 1} (score ${results[i - 1].score}) should be >= result ${i} (score ${results[i].score})`
      );
    }
  });

  test("ties are broken by label ascending", () => {
    const index = makeIndex();
    const results = fuzzySearch("log", index);
    for (let i = 1; i < results.length; i++) {
      if (results[i - 1].score === results[i].score) {
        assert.ok(
          results[i - 1].item.label <= results[i].item.label,
          `Tied results should be sorted by label: "${results[i - 1].item.label}" <= "${results[i].item.label}"`
        );
      }
    }
  });

  test("respects limit parameter", () => {
    const index = makeIndex();
    const results = fuzzySearch("a", index, 2);
    assert.ok(results.length <= 2);
  });

  test("default limit is 20", () => {
    // Create a large index
    const nodes = [];
    for (let i = 0; i < 30; i++) {
      nodes.push({ id: `src/f${i}.ts#func${i}`, symbolName: `func${i}`, filePath: `src/f${i}.ts` });
    }
    const index = buildSearchIndex({ nodes, testFiles: [], featureModules: [] });
    const results = fuzzySearch("func", index);
    assert.ok(results.length <= 20);
  });

  test("populates labelMatches and secondaryMatches", () => {
    const index = makeIndex();
    const results = fuzzySearch("login", index);
    const loginResult = results.find((r: any) => r.item.label === "login");
    assert.ok(loginResult);
    assert.ok(Array.isArray(loginResult.labelMatches));
    assert.ok(Array.isArray(loginResult.secondaryMatches));
  });

  test("exact label search returns that item first", () => {
    const index = makeIndex();
    const results = fuzzySearch("formatDate", index);
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].item.label, "formatDate");
  });

  test("matches against secondaryLabel too", () => {
    const index = makeIndex();
    // Search for a file path fragment — should match via secondaryLabel
    const results = fuzzySearch("auth.ts", index);
    assert.ok(results.length > 0);
  });
});
