# Implementation Plan: Fuzzy Search

## Overview

This plan implements an in-webview fuzzy search system for the Blast Radius extension. The search engine logic is extracted into a standalone `media/searchEngine.js` module (plain JS, importable by both the webview and the test suite), the webview HTML and `graph.js` are updated to integrate the search UI, and property-based tests validate the correctness properties defined in the design. Implementation proceeds bottom-up: engine logic first, then UI integration, then wiring and navigation.

## Tasks

- [x] 1. Create the search engine module (`media/searchEngine.js`)
  - [x] 1.1 Implement `buildSearchIndex(graphData)` function
    - Accept a graph data object with `nodes`, `testFiles`, and `featureModules` arrays
    - Return a flat array of `SearchItem` objects with `id`, `label`, `secondaryLabel`, `category`, `labelLower`, and `secondaryLower` fields
    - For function nodes: `label` = `symbolName`, `secondaryLabel` = `filePath`, `category` = `"function"`, `id` = `node.id`
    - For test files: `label` = file name (last path segment), `secondaryLabel` = full path, `category` = `"test"`, `id` = path
    - For modules: `label` = module name, `secondaryLabel` = `""`, `category` = `"module"`, `id` = module name
    - Pre-compute `labelLower` and `secondaryLower` as lowercased versions
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3_

  - [x] 1.2 Implement `fuzzyScore(query, text)` function
    - Accept a query string and a target text string
    - Return `{ score, matches }` or `null` if no match
    - Implement three scoring tiers: prefix match (3.0 + query.length/text.length), substring match (2.0 + query.length/text.length), subsequence match (1.0 + matched/text.length)
    - Record matched character indices in the `matches` array
    - Perform all comparisons case-insensitively
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 1.3 Implement `fuzzySearch(query, index, limit)` function
    - Score each item in the index against the query using `fuzzyScore` on both `labelLower` and `secondaryLower`, taking the better score
    - Populate `labelMatches` and `secondaryMatches` on each result
    - Sort results by score descending, then by label ascending for ties
    - Return at most `limit` results (default 20)
    - Return empty array for empty/whitespace queries
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 4.2_

  - [x] 1.4 Write property test: Index completeness and correctness (Property 1)
    - **Property 1: Index completeness and correctness**
    - Generate random graph data payloads with `graphDataArb` and verify `buildSearchIndex` produces exactly one SearchItem per function node, test file, and module with correct fields
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 8.1, 8.2, 8.3**

  - [x] 1.5 Write property test: Index rebuild replaces old data (Property 2)
    - **Property 2: Index rebuild replaces old data**
    - Generate two distinct graph data payloads, build index from first then rebuild from second, verify only second payload items remain
    - **Validates: Requirements 2.5**

  - [x] 1.6 Write property test: Substring and subsequence matching coverage (Property 3)
    - **Property 3: Substring and subsequence matching coverage**
    - Generate target strings and derive substring/subsequence queries, verify `fuzzyScore` returns non-null with positive score
    - **Validates: Requirements 3.1**

  - [x] 1.7 Write property test: Score tier ordering (Property 4)
    - **Property 4: Score tier ordering**
    - Generate target strings of length ≥ 3, derive prefix, non-prefix substring, and subsequence-only queries, verify prefix > substring > subsequence scores
    - **Validates: Requirements 3.2**

  - [x] 1.8 Write property test: Results sorted by score descending, ties by label ascending (Property 5)
    - **Property 5: Results sorted by score descending, ties by label ascending**
    - Generate search indexes and queries, verify `fuzzySearch` output ordering invariant
    - **Validates: Requirements 3.3, 3.4**

  - [x] 1.9 Write property test: Case-insensitive matching (Property 6)
    - **Property 6: Case-insensitive matching**
    - Generate query/target pairs, verify `fuzzyScore` returns same score regardless of query casing
    - **Validates: Requirements 3.5**

  - [x] 1.10 Write property test: Exact label round-trip (Property 7)
    - **Property 7: Exact label round-trip**
    - Generate search indexes, search with exact label of each item, verify it appears as first result
    - **Validates: Requirements 3.6**

  - [x] 1.11 Write property test: Maximum result count (Property 8)
    - **Property 8: Maximum result count**
    - Generate large indexes and queries, verify `fuzzySearch` returns at most 20 results
    - **Validates: Requirements 4.2**

  - [x] 1.12 Write property test: Match indices validity (Property 9)
    - **Property 9: Match indices validity**
    - Generate query/target pairs where `fuzzyScore` returns non-null, verify all match indices are valid, ascending, and correspond to query characters
    - **Validates: Requirements 4.5**

- [x] 2. Checkpoint — Verify search engine logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add search UI to the webview
  - [x] 3.1 Add search HTML elements to `webviewProvider.ts`
    - Add `#search-container` div with `#search-input` and `#search-results` list to the webview HTML template
    - Position at top-center of the graph panel
    - Style using VS Code theme CSS variables (`--vscode-input-background`, `--vscode-input-foreground`, `--vscode-input-border`, etc.)
    - Include placeholder text "Search functions, tests, modules…"
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 3.2 Add search CSS styles to `webviewProvider.ts`
    - Style `#search-container` for top-center fixed positioning with z-index above graph
    - Style `#search-results` as a dropdown list below the input
    - Style result items with category badges (`ƒ` for functions, `⬡` for tests, `▣` for modules)
    - Style `<mark>` elements for match highlighting
    - Style active/hover states for keyboard navigation
    - Style "No results found" empty state
    - _Requirements: 1.5, 4.3, 4.4, 4.5, 8.4_

- [x] 4. Integrate search engine into `graph.js`
  - [x] 4.1 Import and wire `searchEngine.js` into the webview
    - Add a `<script>` tag for `media/searchEngine.js` in `webviewProvider.ts` (with nonce)
    - In `graph.js`, call `buildSearchIndex(graphData)` inside the `graph-data` message handler to build/rebuild the index
    - Store the index in a module-level variable
    - _Requirements: 2.1, 2.5_

  - [x] 4.2 Implement search input event handling in `graph.js`
    - Add `input` event listener on `#search-input` that calls `fuzzySearch(query, index)` and renders results
    - Implement result rendering: group by category (functions → tests → modules), show category badge, primary label with `<mark>` highlights, secondary label
    - Show "No results found" when query has no matches
    - Hide result list when input is empty
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.1, 8.2, 8.3, 8.4_

  - [x] 4.3 Implement keyboard navigation in `graph.js`
    - `/` key (when input not focused): focus search input
    - `Escape` key (when input focused): clear input, close results, blur input
    - `ArrowDown` / `ArrowUp` (when results visible): move active highlight between results
    - `Enter` (when results visible): select the active or first result
    - _Requirements: 1.2, 1.3, 5.4, 5.5_

  - [x] 4.4 Implement result selection and graph navigation in `graph.js`
    - Function result: `cy.center(node)`, zoom in, trigger `node-click` postMessage for blast radius
    - Test result: `cy.center(node)`, zoom in
    - Module result: `cy.fit(moduleNodes, 60)` to show all nodes in that module
    - After selection: clear input, hide results, return focus to graph
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.4_

  - [x] 4.5 Implement event isolation in `graph.js`
    - Add `stopPropagation()` on `click` and `mousedown` events on `#search-container` to prevent Cytoscape canvas interaction
    - Add click-outside handler to close result list when clicking outside search container
    - Ensure search returns all indexed items regardless of active blast radius highlight
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 4.6 Write unit tests for search UI interactions
    - Test `/` key focuses search input
    - Test `Escape` key clears input and closes results
    - Test ArrowUp/ArrowDown keyboard navigation
    - Test Enter key selects first result
    - Test result rendering with category badges and match highlighting
    - Test "No results found" display
    - Test empty query hides result list
    - _Requirements: 1.2, 1.3, 4.1, 4.3, 4.5, 4.6, 5.4, 5.5_

- [x] 5. Checkpoint — Verify full integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Data privacy verification
  - [x] 6.1 Verify search engine has no external network access
    - Confirm `searchEngine.js` makes no `fetch`, `XMLHttpRequest`, or WebSocket calls
    - Confirm the existing CSP in `webviewProvider.ts` (`default-src 'none'`) blocks any external requests
    - Ensure the new `<script>` tag for `searchEngine.js` uses the nonce and `vscode-resource:` URI
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The search engine is plain JavaScript (`media/searchEngine.js`) to match the webview environment; tests are TypeScript and import the JS module
- The webview HTML changes are in `src/webview/webviewProvider.ts` (the `getHtmlContent` method)
