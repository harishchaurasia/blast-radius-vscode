/**
 * Fuzzy Search Engine for Blast Radius webview.
 *
 * Pure-function search logic: builds an index from graph data,
 * scores queries with a three-tier fuzzy matcher, and returns
 * ranked results. No external dependencies.
 *
 * Works in the browser (attaches to window.SearchEngine) and
 * in Node.js (CommonJS module.exports) for testing.
 */
(function (exports) {
  "use strict";

  /**
   * Build a flat searchable index from graph data.
   *
   * @param {object} graphData - Graph data with `nodes`, `testFiles`, and `featureModules` arrays.
   * @returns {Array<SearchItem>} Flat array of searchable items.
   */
  function buildSearchIndex(graphData) {
    var index = [];

    if (!graphData) {
      return index;
    }

    // Index function nodes
    var nodes = graphData.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      index.push({
        id: node.id,
        label: node.symbolName,
        secondaryLabel: node.filePath,
        category: "function",
        labelLower: node.symbolName.toLowerCase(),
        secondaryLower: node.filePath.toLowerCase(),
      });
    }

    // Index test files
    var testFiles = graphData.testFiles || [];
    for (var t = 0; t < testFiles.length; t++) {
      var testFile = testFiles[t];
      var path = testFile.path;
      var segments = path.split("/");
      var fileName = segments[segments.length - 1];
      index.push({
        id: path,
        label: fileName,
        secondaryLabel: path,
        category: "test",
        labelLower: fileName.toLowerCase(),
        secondaryLower: path.toLowerCase(),
      });
    }

    // Index feature modules
    var modules = graphData.featureModules || [];
    for (var m = 0; m < modules.length; m++) {
      var moduleName = modules[m];
      index.push({
        id: moduleName,
        label: moduleName,
        secondaryLabel: "",
        category: "module",
        labelLower: moduleName.toLowerCase(),
        secondaryLower: "",
      });
    }

    return index;
  }

  /**
   * Score a query against a single text string using three-tier fuzzy matching.
   *
   * Scoring tiers:
   *   - Prefix match:     3.0 + query.length / text.length
   *   - Substring match:  2.0 + query.length / text.length
   *   - Subsequence match: 1.0 + matchedCount / text.length
   *
   * @param {string} query - The search query.
   * @param {string} text  - The target text to match against.
   * @returns {{ score: number, matches: number[] } | null} Match result or null.
   */
  function fuzzyScore(query, text) {
    if (!query || !text) {
      return null;
    }

    var queryLower = query.toLowerCase();
    var textLower = text.toLowerCase();

    // Tier 1: Prefix match
    if (textLower.indexOf(queryLower) === 0) {
      var matches = [];
      for (var i = 0; i < queryLower.length; i++) {
        matches.push(i);
      }
      return {
        score: 3.0 + queryLower.length / textLower.length,
        matches: matches,
      };
    }

    // Tier 2: Substring (contiguous) match
    var substringIdx = textLower.indexOf(queryLower);
    if (substringIdx > 0) {
      var matches2 = [];
      for (var j = 0; j < queryLower.length; j++) {
        matches2.push(substringIdx + j);
      }
      return {
        score: 2.0 + queryLower.length / textLower.length,
        matches: matches2,
      };
    }

    // Tier 3: Subsequence match
    var matchIndices = [];
    var qi = 0;
    for (var ti = 0; ti < textLower.length && qi < queryLower.length; ti++) {
      if (textLower[ti] === queryLower[qi]) {
        matchIndices.push(ti);
        qi++;
      }
    }

    if (qi === queryLower.length) {
      return {
        score: 1.0 + matchIndices.length / textLower.length,
        matches: matchIndices,
      };
    }

    // No match
    return null;
  }

  /**
   * Search the index for items matching the query.
   *
   * Scores each item against both label and secondary label, taking the
   * better score. Returns up to `limit` results sorted by score descending,
   * then by label ascending for ties.
   *
   * @param {string} query - The search query.
   * @param {Array<SearchItem>} index - The search index built by buildSearchIndex.
   * @param {number} [limit=20] - Maximum number of results to return.
   * @returns {Array<SearchResult>} Sorted search results.
   */
  function fuzzySearch(query, index, limit) {
    if (limit === undefined || limit === null) {
      limit = 20;
    }

    if (!query || !query.trim()) {
      return [];
    }

    var results = [];

    for (var i = 0; i < index.length; i++) {
      var item = index[i];
      var labelResult = fuzzyScore(query, item.labelLower);
      var secondaryResult = fuzzyScore(query, item.secondaryLower);

      var bestScore = null;
      var labelMatches = [];
      var secondaryMatches = [];

      if (labelResult && secondaryResult) {
        if (labelResult.score >= secondaryResult.score) {
          bestScore = labelResult.score;
          labelMatches = labelResult.matches;
          secondaryMatches = [];
        } else {
          bestScore = secondaryResult.score;
          labelMatches = [];
          secondaryMatches = secondaryResult.matches;
        }
      } else if (labelResult) {
        bestScore = labelResult.score;
        labelMatches = labelResult.matches;
      } else if (secondaryResult) {
        bestScore = secondaryResult.score;
        secondaryMatches = secondaryResult.matches;
      }

      if (bestScore !== null) {
        results.push({
          item: item,
          score: bestScore,
          labelMatches: labelMatches,
          secondaryMatches: secondaryMatches,
        });
      }
    }

    // Sort: score descending, then label ascending for ties
    results.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.item.label < b.item.label) {
        return -1;
      }
      if (a.item.label > b.item.label) {
        return 1;
      }
      return 0;
    });

    return results.slice(0, limit);
  }

  // Export for both browser and Node.js environments
  exports.buildSearchIndex = buildSearchIndex;
  exports.fuzzyScore = fuzzyScore;
  exports.fuzzySearch = fuzzySearch;

})(typeof module !== "undefined" && module.exports
  ? module.exports
  : (typeof window !== "undefined"
    ? (window.SearchEngine = window.SearchEngine || {})
    : {}));
