import * as assert from "assert";
import * as fc from "fast-check";

const {
  buildSearchIndex,
  fuzzyScore,
  fuzzySearch,
} = require("../../../media/searchEngine");

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Alphanumeric character arbitrary */
const alphaNumChar = fc.constantFrom(
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")
);

/** Non-empty alphanumeric string of length 1–30 */
const searchableStringArb = fc
  .array(alphaNumChar, { minLength: 1, maxLength: 30 })
  .map((chars) => chars.join(""));

/** Simple path segment */
const pathSegmentArb = fc
  .array(alphaNumChar, { minLength: 1, maxLength: 10 })
  .map((chars) => chars.join(""));

/** File path like "src/dir/file.ts" */
const filePathArb = fc
  .tuple(pathSegmentArb, pathSegmentArb, pathSegmentArb)
  .map(([dir, subdir, file]) => `${dir}/${subdir}/${file}.ts`);

/** Function node arbitrary */
const functionNodeArb = fc
  .tuple(filePathArb, searchableStringArb)
  .map(([filePath, symbolName]) => ({
    id: `${filePath}#${symbolName}`,
    symbolName,
    filePath,
  }));

/** Test file arbitrary */
const testFileArb = fc
  .tuple(pathSegmentArb, pathSegmentArb)
  .map(([dir, name]) => ({
    path: `${dir}/test/${name}.test.ts`,
  }));

/** Module name arbitrary */
const moduleNameArb = searchableStringArb;

/** Graph data arbitrary: 1–50 nodes, 0–10 test files, 0–5 modules */
const graphDataArb = fc.record({
  nodes: fc.array(functionNodeArb, { minLength: 1, maxLength: 50 }),
  testFiles: fc.array(testFileArb, { minLength: 0, maxLength: 10 }),
  featureModules: fc.array(moduleNameArb, { minLength: 0, maxLength: 5 }),
});

// ---------------------------------------------------------------------------
// Helper functions for deriving queries
// ---------------------------------------------------------------------------

/** Extract a random prefix from a target string (at least 1 char, at most full length) */
function prefixQueryArb(target: string): fc.Arbitrary<string> {
  return fc.integer({ min: 1, max: target.length }).map((len) => target.slice(0, len));
}

/**
 * Extract a random non-prefix contiguous substring from a target string.
 * Requires target.length >= 2 so we can start at index >= 1.
 */
function nonPrefixSubstringQueryArb(target: string): fc.Arbitrary<string> {
  return fc
    .integer({ min: 1, max: target.length - 1 })
    .chain((start) =>
      fc
        .integer({ min: start + 1, max: target.length })
        .map((end) => target.slice(start, end))
    );
}

/**
 * Extract a random subsequence (non-contiguous characters in order) from a target string.
 * Each character is independently included or excluded, but at least one is included.
 */
function subsequenceQueryArb(target: string): fc.Arbitrary<string> {
  return fc
    .array(fc.boolean(), { minLength: target.length, maxLength: target.length })
    .filter((mask) => mask.some(Boolean))
    .map((mask) => target.split("").filter((_, i) => mask[i]).join(""));
}

/**
 * Generate a subsequence-only query: a subsequence that is NOT a contiguous substring.
 * Requires target.length >= 3.
 */
function subsequenceOnlyQueryArb(target: string): fc.Arbitrary<string> {
  // Pick two indices that are not adjacent, take those characters
  // Strategy: pick chars at positions that skip at least one character
  const targetLower = target.toLowerCase();
  return fc
    .array(fc.boolean(), { minLength: target.length, maxLength: target.length })
    .filter((mask) => {
      const selected = mask.reduce((acc, v) => acc + (v ? 1 : 0), 0);
      if (selected < 2) { return false; }
      // Build the subsequence and check it's not a contiguous substring
      const subseq = target
        .split("")
        .filter((_, i) => mask[i])
        .join("")
        .toLowerCase();
      return targetLower.indexOf(subseq) === -1;
    })
    .map((mask) => target.split("").filter((_, i) => mask[i]).join(""));
}

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

suite("Fuzzy Search Property Tests", () => {
  /**
   * Property 1: Index completeness and correctness
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3**
   */
  test("Property 1 — Index completeness and correctness", () => {
    fc.assert(
      fc.property(graphDataArb, (graphData) => {
        const index = buildSearchIndex(graphData);

        const expectedLength =
          graphData.nodes.length +
          graphData.testFiles.length +
          graphData.featureModules.length;

        // Total index length equals sum of all input arrays
        assert.strictEqual(index.length, expectedLength);

        let offset = 0;

        // Verify function nodes
        for (let i = 0; i < graphData.nodes.length; i++) {
          const node = graphData.nodes[i];
          const item = index[offset + i];
          assert.strictEqual(item.id, node.id);
          assert.strictEqual(item.label, node.symbolName);
          assert.strictEqual(item.secondaryLabel, node.filePath);
          assert.strictEqual(item.category, "function");
          assert.strictEqual(item.labelLower, node.symbolName.toLowerCase());
          assert.strictEqual(item.secondaryLower, node.filePath.toLowerCase());
        }
        offset += graphData.nodes.length;

        // Verify test files
        for (let i = 0; i < graphData.testFiles.length; i++) {
          const testFile = graphData.testFiles[i];
          const path = testFile.path;
          const segments = path.split("/");
          const fileName = segments[segments.length - 1];
          const item = index[offset + i];
          assert.strictEqual(item.id, path);
          assert.strictEqual(item.label, fileName);
          assert.strictEqual(item.secondaryLabel, path);
          assert.strictEqual(item.category, "test");
          assert.strictEqual(item.labelLower, fileName.toLowerCase());
          assert.strictEqual(item.secondaryLower, path.toLowerCase());
        }
        offset += graphData.testFiles.length;

        // Verify modules
        for (let i = 0; i < graphData.featureModules.length; i++) {
          const moduleName = graphData.featureModules[i];
          const item = index[offset + i];
          assert.strictEqual(item.id, moduleName);
          assert.strictEqual(item.label, moduleName);
          assert.strictEqual(item.secondaryLabel, "");
          assert.strictEqual(item.category, "module");
          assert.strictEqual(item.labelLower, moduleName.toLowerCase());
          assert.strictEqual(item.secondaryLower, "");
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Index rebuild replaces old data
   * **Validates: Requirements 2.5**
   */
  test("Property 2 — Index rebuild replaces old data", () => {
    fc.assert(
      fc.property(graphDataArb, graphDataArb, (graphData1, graphData2) => {
        // Build index from first payload
        const _index1 = buildSearchIndex(graphData1);

        // Rebuild from second payload
        const index2 = buildSearchIndex(graphData2);

        const expectedLength =
          graphData2.nodes.length +
          graphData2.testFiles.length +
          graphData2.featureModules.length;

        // Only second payload items remain
        assert.strictEqual(index2.length, expectedLength);

        // Verify all items come from second payload
        let offset = 0;
        for (let i = 0; i < graphData2.nodes.length; i++) {
          assert.strictEqual(index2[offset + i].id, graphData2.nodes[i].id);
        }
        offset += graphData2.nodes.length;
        for (let i = 0; i < graphData2.testFiles.length; i++) {
          assert.strictEqual(index2[offset + i].id, graphData2.testFiles[i].path);
        }
        offset += graphData2.testFiles.length;
        for (let i = 0; i < graphData2.featureModules.length; i++) {
          assert.strictEqual(index2[offset + i].id, graphData2.featureModules[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Substring and subsequence matching coverage
   * **Validates: Requirements 3.1**
   */
  test("Property 3 — Substring matching coverage", () => {
    fc.assert(
      fc.property(
        searchableStringArb.filter((s) => s.length >= 2),
        fc.gen().map((gen) => gen),
        (target, gen) => {
          // Derive a substring query from the target
          const start = gen(fc.integer, { min: 0, max: target.length - 1 });
          const end = gen(fc.integer, { min: start + 1, max: target.length });
          const substringQuery = target.slice(start, end);

          const result = fuzzyScore(substringQuery, target);
          assert.notStrictEqual(result, null, `Expected match for substring "${substringQuery}" in "${target}"`);
          assert.ok(result.score > 0, `Expected positive score, got ${result.score}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("Property 3 — Subsequence matching coverage", () => {
    fc.assert(
      fc.property(
        searchableStringArb.filter((s) => s.length >= 2),
        (target) => {
          // Take every other character as a subsequence
          const subseqChars: string[] = [];
          for (let i = 0; i < target.length; i += 2) {
            subseqChars.push(target[i]);
          }
          const subseqQuery = subseqChars.join("");
          if (subseqQuery.length === 0) { return; }

          const result = fuzzyScore(subseqQuery, target);
          assert.notStrictEqual(result, null, `Expected match for subsequence "${subseqQuery}" in "${target}"`);
          assert.ok(result.score > 0, `Expected positive score, got ${result.score}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Score tier ordering
   * **Validates: Requirements 3.2**
   */
  test("Property 4 — Score tier ordering", () => {
    fc.assert(
      fc.property(
        searchableStringArb.filter((s) => s.length >= 4),
        fc.gen().map((gen) => gen),
        (target, gen) => {
          // Prefix query: first N characters (1 to length-1 so it's a proper prefix)
          const prefixLen = gen(fc.integer, { min: 1, max: Math.min(target.length - 1, target.length) });
          const prefixQuery = target.slice(0, prefixLen);

          // Non-prefix substring query: a contiguous middle segment starting at index >= 1
          // We need the substring to NOT be a prefix of the target
          const subStart = gen(fc.integer, { min: 1, max: target.length - 2 });
          const subEnd = gen(fc.integer, { min: subStart + 1, max: target.length });
          const substringQuery = target.slice(subStart, subEnd);

          // Verify the substring is truly not a prefix
          if (target.toLowerCase().indexOf(substringQuery.toLowerCase()) === 0) {
            return; // Skip this case — the substring happens to also be a prefix
          }

          // Subsequence-only query: pick non-adjacent characters
          // Take first char, skip one, take next, skip one, etc. — but only if it's not a contiguous substring
          const subseqChars: string[] = [];
          for (let i = 0; i < target.length; i += 2) {
            subseqChars.push(target[i]);
          }
          const subseqQuery = subseqChars.join("");

          // Verify the subsequence is not a contiguous substring of the target
          if (target.toLowerCase().indexOf(subseqQuery.toLowerCase()) !== -1) {
            return; // Skip — the subsequence happens to be a contiguous substring
          }

          const prefixResult = fuzzyScore(prefixQuery, target);
          const substringResult = fuzzyScore(substringQuery, target);
          const subseqResult = fuzzyScore(subseqQuery, target);

          assert.notStrictEqual(prefixResult, null, `Prefix query "${prefixQuery}" should match "${target}"`);
          assert.notStrictEqual(substringResult, null, `Substring query "${substringQuery}" should match "${target}"`);
          assert.notStrictEqual(subseqResult, null, `Subsequence query "${subseqQuery}" should match "${target}"`);

          assert.ok(
            prefixResult.score > substringResult.score,
            `Prefix score (${prefixResult.score}) should be > substring score (${substringResult.score}) for target "${target}"`
          );
          assert.ok(
            substringResult.score > subseqResult.score,
            `Substring score (${substringResult.score}) should be > subsequence score (${subseqResult.score}) for target "${target}"`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Results sorted by score descending, ties by label ascending
   * **Validates: Requirements 3.3, 3.4**
   */
  test("Property 5 — Results sorted by score descending, ties by label ascending", () => {
    fc.assert(
      fc.property(graphDataArb, searchableStringArb, (graphData, query) => {
        const index = buildSearchIndex(graphData);
        const results = fuzzySearch(query, index);

        for (let i = 1; i < results.length; i++) {
          const prev = results[i - 1];
          const curr = results[i];

          if (prev.score !== curr.score) {
            assert.ok(
              prev.score > curr.score,
              `Results not sorted by score descending: ${prev.score} should be > ${curr.score}`
            );
          } else {
            assert.ok(
              prev.item.label <= curr.item.label,
              `Tied results not sorted by label ascending: "${prev.item.label}" should be <= "${curr.item.label}"`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Case-insensitive matching
   * **Validates: Requirements 3.5**
   */
  test("Property 6 — Case-insensitive matching", () => {
    fc.assert(
      fc.property(searchableStringArb, searchableStringArb, (query, target) => {
        const lowerResult = fuzzyScore(query.toLowerCase(), target);
        const upperResult = fuzzyScore(query.toUpperCase(), target);

        if (lowerResult === null) {
          assert.strictEqual(
            upperResult,
            null,
            `Lower case returned null but upper case returned non-null for query="${query}", target="${target}"`
          );
        } else {
          assert.notStrictEqual(
            upperResult,
            null,
            `Lower case returned non-null but upper case returned null for query="${query}", target="${target}"`
          );
          assert.strictEqual(
            lowerResult.score,
            upperResult.score,
            `Scores differ for different casings: lower=${lowerResult.score}, upper=${upperResult.score}`
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Exact label round-trip
   * **Validates: Requirements 3.6**
   *
   * For any search index, searching with the exact label of any item SHALL
   * return that item as the first result. When multiple items share the same
   * label (case-insensitively), the tie-breaker is alphabetical by label, so
   * we verify the item appears first among results with the top score.
   */
  test("Property 7 — Exact label round-trip", () => {
    fc.assert(
      fc.property(graphDataArb, (graphData) => {
        const index = buildSearchIndex(graphData);
        if (index.length === 0) { return; }

        // Deduplicate: only test one item per unique label (case-insensitive)
        // to avoid the tie-breaking edge case where "T" sorts before "t"
        const seenLabels = new Set<string>();
        const uniqueItems: any[] = [];
        for (const item of index) {
          const key = item.labelLower;
          if (!seenLabels.has(key)) {
            seenLabels.add(key);
            uniqueItems.push(item);
          }
        }

        for (const item of uniqueItems) {
          const results = fuzzySearch(item.label, index);
          assert.ok(
            results.length > 0,
            `Searching for exact label "${item.label}" returned no results`
          );

          // The first result should have a label that matches case-insensitively
          assert.strictEqual(
            results[0].item.labelLower,
            item.labelLower,
            `Exact label "${item.label}" should be the first result (case-insensitive), got "${results[0].item.label}"`
          );

          // The searched item must appear in the results
          const found = results.some(
            (r: any) => r.item.id === item.id
          );
          assert.ok(
            found,
            `Item with id "${item.id}" and label "${item.label}" not found in results`
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Maximum result count
   * **Validates: Requirements 4.2**
   */
  test("Property 8 — Maximum result count", () => {
    // Generate a large index with many items that will match a common query
    const largeGraphDataArb = fc.record({
      nodes: fc.array(functionNodeArb, { minLength: 25, maxLength: 50 }),
      testFiles: fc.array(testFileArb, { minLength: 5, maxLength: 10 }),
      featureModules: fc.array(moduleNameArb, { minLength: 3, maxLength: 5 }),
    });

    fc.assert(
      fc.property(largeGraphDataArb, searchableStringArb, (graphData, query) => {
        const index = buildSearchIndex(graphData);
        const results = fuzzySearch(query, index);

        assert.ok(
          results.length <= 20,
          `Expected at most 20 results, got ${results.length}`
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Match indices validity
   * **Validates: Requirements 4.5**
   */
  test("Property 9 — Match indices validity", () => {
    fc.assert(
      fc.property(searchableStringArb, searchableStringArb, (query, target) => {
        const result = fuzzyScore(query, target);

        if (result === null) { return; } // No match — nothing to validate

        const matches: number[] = result.matches;
        const queryLower = query.toLowerCase();
        const targetLower = target.toLowerCase();

        // matches array length should equal query length
        assert.strictEqual(
          matches.length,
          query.length,
          `Expected ${query.length} match indices, got ${matches.length}`
        );

        for (let i = 0; i < matches.length; i++) {
          const idx = matches[i];

          // Valid index within target
          assert.ok(
            idx >= 0 && idx < target.length,
            `Match index ${idx} is out of bounds for target of length ${target.length}`
          );

          // Strictly ascending
          if (i > 0) {
            assert.ok(
              idx > matches[i - 1],
              `Match indices not strictly ascending: ${matches[i - 1]} then ${idx}`
            );
          }

          // Character at index matches corresponding query character
          assert.strictEqual(
            targetLower[idx],
            queryLower[i],
            `Character mismatch at match index ${idx}: target has "${targetLower[idx]}", query expects "${queryLower[i]}"`
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
