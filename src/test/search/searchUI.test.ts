import * as assert from "assert";

// Import the plain JS search engine module
const {
  buildSearchIndex,
  fuzzyScore,
  fuzzySearch,
} = require("../../../media/searchEngine");

/**
 * Unit tests for search UI interactions.
 *
 * The search UI lives in media/graph.js (a VS Code webview with DOM + Cytoscape).
 * Since we cannot directly test DOM event handlers in the Mocha test host, these
 * tests validate the search engine behaviour that drives each UI interaction.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSampleIndex() {
  return buildSearchIndex({
    nodes: [
      { id: "src/auth.ts#login", symbolName: "login", filePath: "src/auth.ts" },
      { id: "src/auth.ts#logout", symbolName: "logout", filePath: "src/auth.ts" },
      { id: "src/utils.ts#formatDate", symbolName: "formatDate", filePath: "src/utils.ts" },
      { id: "src/cart.ts#addItem", symbolName: "addItem", filePath: "src/cart.ts" },
      { id: "src/cart.ts#removeItem", symbolName: "removeItem", filePath: "src/cart.ts" },
    ],
    testFiles: [
      { path: "src/test/auth/login.test.ts" },
      { path: "src/test/cart/cart.test.ts" },
    ],
    featureModules: ["auth", "cart", "utils"],
  });
}

// ---------------------------------------------------------------------------
// `/` key focuses search input — search engine returns results when called
// ---------------------------------------------------------------------------

suite("Search UI: `/` key focus scenario", () => {
  test("search engine returns results when invoked (simulates post-focus typing)", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login", index);
    assert.ok(results.length > 0, "Should return results after focus + typing");
    assert.strictEqual(results[0].item.label, "login");
  });
});

// ---------------------------------------------------------------------------
// `Escape` key clears input and closes results — empty/cleared input returns []
// ---------------------------------------------------------------------------

suite("Search UI: Escape key clears input", () => {
  test("empty query returns empty results (simulates cleared input)", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("", index);
    assert.deepStrictEqual(results, []);
  });

  test("whitespace-only query returns empty results", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("   ", index);
    assert.deepStrictEqual(results, []);
  });

  test("null query returns empty results", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch(null, index);
    assert.deepStrictEqual(results, []);
  });
});

// ---------------------------------------------------------------------------
// ArrowUp/ArrowDown keyboard navigation — results maintain correct ordering
// ---------------------------------------------------------------------------

suite("Search UI: ArrowUp/ArrowDown navigation ordering", () => {
  test("results are in deterministic order for keyboard traversal", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("log", index);
    assert.ok(results.length >= 2, "Should have multiple results to navigate");

    // Verify score-descending order (ArrowDown traverses top to bottom)
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1].score >= results[i].score,
        `Result ${i - 1} (score ${results[i - 1].score}) should be >= result ${i} (score ${results[i].score})`
      );
    }
  });

  test("tied scores are ordered by label ascending for predictable navigation", () => {
    // Build an index where multiple items will have the same score
    const index = buildSearchIndex({
      nodes: [
        { id: "a.ts#beta", symbolName: "beta", filePath: "a.ts" },
        { id: "b.ts#alpha", symbolName: "alpha", filePath: "b.ts" },
        { id: "c.ts#gamma", symbolName: "gamma", filePath: "c.ts" },
      ],
      testFiles: [],
      featureModules: [],
    });

    const results = fuzzySearch("a", index);
    // Check that ties are broken alphabetically
    for (let i = 1; i < results.length; i++) {
      if (results[i - 1].score === results[i].score) {
        assert.ok(
          results[i - 1].item.label <= results[i].item.label,
          `Tied results should be alphabetical: "${results[i - 1].item.label}" <= "${results[i].item.label}"`
        );
      }
    }
  });

  test("navigation wraps around — last result index is results.length - 1", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("a", index);
    assert.ok(results.length > 0, "Should have results");
    // The UI wraps ArrowDown from last index to 0, and ArrowUp from 0 to last.
    // Verify the last valid index is results.length - 1
    const lastIndex = results.length - 1;
    assert.ok(lastIndex >= 0);
    assert.ok(results[lastIndex].item !== undefined);
  });
});

// ---------------------------------------------------------------------------
// Enter key selects first result
// ---------------------------------------------------------------------------

suite("Search UI: Enter key selects first result", () => {
  test("first result for exact query is the expected item", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login", index);
    assert.ok(results.length > 0);
    // Enter with no active selection picks index 0
    const selected = results[0];
    assert.strictEqual(selected.item.label, "login");
    assert.strictEqual(selected.item.id, "src/auth.ts#login");
    assert.strictEqual(selected.item.category, "function");
  });

  test("first result for partial query is the best match", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("format", index);
    assert.ok(results.length > 0);
    const selected = results[0];
    assert.strictEqual(selected.item.label, "formatDate");
  });

  test("first result for test file query returns test item", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login.test", index);
    assert.ok(results.length > 0);
    const selected = results[0];
    assert.strictEqual(selected.item.category, "test");
    assert.strictEqual(selected.item.label, "login.test.ts");
  });

  test("first result for module query returns module item", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("auth", index);
    assert.ok(results.length > 0);
    // "auth" should match the module with a high score (exact/prefix match)
    const moduleResult = results.find((r: any) => r.item.category === "module" && r.item.label === "auth");
    assert.ok(moduleResult, "Should find the auth module in results");
  });
});

// ---------------------------------------------------------------------------
// Result rendering with category badges and match highlighting
// ---------------------------------------------------------------------------

suite("Search UI: Result data for rendering", () => {
  test("each result has a category field for badge rendering", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("a", index);
    assert.ok(results.length > 0);

    const validCategories = new Set(["function", "test", "module"]);
    for (const result of results) {
      assert.ok(
        validCategories.has(result.item.category),
        `Category "${result.item.category}" should be one of function, test, module`
      );
    }
  });

  test("function results have correct category for ƒ badge", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login", index);
    const funcResult = results.find((r: any) => r.item.label === "login");
    assert.ok(funcResult);
    assert.strictEqual(funcResult.item.category, "function");
  });

  test("test results have correct category for ⬡ badge", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login.test", index);
    const testResult = results.find((r: any) => r.item.category === "test");
    assert.ok(testResult);
    assert.strictEqual(testResult.item.category, "test");
  });

  test("module results have correct category for ▣ badge", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("cart", index);
    const moduleResult = results.find((r: any) => r.item.category === "module" && r.item.label === "cart");
    assert.ok(moduleResult);
    assert.strictEqual(moduleResult.item.category, "module");
  });

  test("labelMatches array is present and contains valid indices for highlighting", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login", index);
    const loginResult = results.find((r: any) => r.item.label === "login");
    assert.ok(loginResult);
    assert.ok(Array.isArray(loginResult.labelMatches), "labelMatches should be an array");
    assert.ok(loginResult.labelMatches.length > 0, "labelMatches should not be empty for a match");

    // All indices should be valid positions within the label
    for (const idx of loginResult.labelMatches) {
      assert.ok(idx >= 0 && idx < loginResult.item.label.length,
        `Match index ${idx} should be within label length ${loginResult.item.label.length}`);
    }
  });

  test("secondaryMatches array is present on results", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("login", index);
    const loginResult = results.find((r: any) => r.item.label === "login");
    assert.ok(loginResult);
    assert.ok(Array.isArray(loginResult.secondaryMatches), "secondaryMatches should be an array");
  });

  test("match indices are strictly ascending for correct highlight rendering", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("fdt", index);
    // "fdt" should subsequence-match "formatDate" → f, d, t
    const fdtResult = results.find((r: any) => r.item.label === "formatDate");
    assert.ok(fdtResult);
    const matches = fdtResult.labelMatches;
    assert.ok(matches.length > 0);
    for (let i = 1; i < matches.length; i++) {
      assert.ok(matches[i] > matches[i - 1], "Match indices should be strictly ascending");
    }
  });
});

// ---------------------------------------------------------------------------
// "No results found" display — query that matches nothing
// ---------------------------------------------------------------------------

suite("Search UI: No results found", () => {
  test("query matching nothing returns empty array (UI shows 'No results found')", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("zzzzxyzzy", index);
    assert.strictEqual(results.length, 0);
  });

  test("query with special characters returns empty array", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("@#$%", index);
    assert.strictEqual(results.length, 0);
  });

  test("very long query returns empty array", () => {
    const index = makeSampleIndex();
    const results = fuzzySearch("a".repeat(100), index);
    assert.strictEqual(results.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Empty query hides result list — empty query returns empty array
// ---------------------------------------------------------------------------

suite("Search UI: Empty query hides result list", () => {
  test("empty string query returns empty array", () => {
    const index = makeSampleIndex();
    assert.deepStrictEqual(fuzzySearch("", index), []);
  });

  test("undefined query returns empty array", () => {
    const index = makeSampleIndex();
    assert.deepStrictEqual(fuzzySearch(undefined, index), []);
  });

  test("transitioning from results to empty query returns empty array", () => {
    const index = makeSampleIndex();
    // First search returns results
    const results = fuzzySearch("login", index);
    assert.ok(results.length > 0);
    // Then clearing the input (empty query) returns nothing
    const cleared = fuzzySearch("", index);
    assert.deepStrictEqual(cleared, []);
  });
});
