# Implementation Plan: Blast Radius

## Overview

Implement the Blast Radius VSCode extension that parses TypeScript projects, builds a call graph, maps Jest tests to source functions, and renders an interactive Cytoscape.js graph in a webview panel. The implementation proceeds incrementally: core types and interfaces first, then parsing, graph construction, test mapping, impact analysis, webview rendering, and finally wiring everything together via the command handler.

## Tasks

- [x] 1. Set up project structure, dependencies, and core interfaces
  - [x] 1.1 Create directory structure and install dependencies
    - Create directories: `src/parser/`, `src/graph/`, `src/analysis/`, `src/webview/`, `media/`
    - Install runtime dependencies: `cytoscape` (bundled for webview)
    - Install dev dependencies: `@types/cytoscape`, `cytoscape-dagre`, `@types/mocha`, `mocha`
    - Update `package.json` commands: replace `blast-radius.helloWorld` with `blast-radius.open` titled "Blast Radius: Open Graph"
    - Update `package.json` activation events to `onCommand:blast-radius.open`
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Define core TypeScript interfaces and types
    - Create `src/types.ts` with interfaces: `FunctionNode`, `CallEdge`, `ParseResult`, `CallGraph`, `TestMap`, `BlastRadiusResult`
    - Create serialized variants: `SerializedFunctionNode`, `SerializedCallEdge`, `SerializedCallGraph`, `SerializedTestMap`
    - Define message types: `GraphDataMessage`, `HighlightMessage`, `NodeClickMessage`
    - Node ID format: `{relativePath}#{symbolName}` (e.g., `src/cart/calc.ts#calculateTotal`)
    - _Requirements: 2.4, 3.1, 12.1_

- [x] 2. Implement Code Parser
  - [x] 2.1 Implement `parseProject` in `src/parser/codeParser.ts`
    - Use `ts.createProgram` with the workspace `tsconfig.json` to load all `.ts` files under `src/`
    - Walk AST with `ts.forEachChild` recursively for each source file
    - Extract `FunctionNode` entries for: named function declarations (`FunctionDeclaration`), arrow functions assigned to `const`/`let` (`VariableDeclaration` with `ArrowFunction` initializer), class methods (`MethodDeclaration`), and exported functions
    - Qualify each `FunctionNode` with relative file path and symbol name; for class methods use `ClassName.methodName`
    - Extract `CallEdge` entries by matching `CallExpression` nodes and resolving called symbols via `TypeChecker.getSymbolAtLocation`
    - Skip dynamic calls (string-keyed property access, `eval`, framework-injected callbacks)
    - Return `ParseResult` with `nodes` and `edges` arrays
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]\* 2.2 Write unit tests for Code Parser
    - Create `src/test/parser/codeParser.test.ts`
    - Test extraction of named functions, arrow functions, class methods, and exported functions
    - Test call edge detection between functions
    - Test that dynamic calls are skipped
    - Test node ID format (`filePath#symbolName`)
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement Graph Builder
  - [x] 3.1 Implement `buildGraph` in `src/graph/graphBuilder.ts`
    - Accept `ParseResult` and construct `CallGraph` with `nodes` Map, `forward` adjacency Map, and `reverse` adjacency Map
    - Deduplicate nodes by ID (`filePath#symbolName`) — last-seen wins for metadata, edges are merged
    - Build forward adjacency: for each `CallEdge`, add `calleeId` to `forward.get(callerId)`
    - Build reverse adjacency: for each `CallEdge`, add `callerId` to `reverse.get(calleeId)`
    - Only include edges where both caller and callee exist in `nodes`
    - Ensure graph invariants: no duplicate nodes, referential integrity, forward/reverse symmetry
    - _Requirements: 3.1, 3.2_

  - [ ]\* 3.2 Write unit tests for Graph Builder
    - Create `src/test/graph/graphBuilder.test.ts`
    - Test deduplication of nodes with same ID
    - Test forward and reverse adjacency construction
    - Test that edges referencing unknown nodes are excluded
    - Test forward/reverse symmetry invariant
    - Test empty input produces empty graph
    - _Requirements: 3.1, 3.2_

- [x] 4. Implement Test Mapper
  - [x] 4.1 Implement `buildTestMap` in `src/parser/testMapper.ts`
    - Find all `*.test.ts` and `*.spec.ts` files in the workspace root
    - Parse each test file to extract import statements
    - Resolve imported symbols to `FunctionNode` IDs in the `CallGraph`
    - For each directly imported node, perform BFS over `graph.forward` to collect all transitively reachable callee nodes
    - Build `TestMap`: map from test file path to the union of direct imports + transitive callees
    - _Requirements: 4.1, 4.2, 5.1, 5.3_

  - [ ]\* 4.2 Write unit tests for Test Mapper
    - Create `src/test/parser/testMapper.test.ts`
    - Test direct import resolution to graph nodes
    - Test transitive expansion through call graph
    - Test that test files with no matching imports produce empty sets
    - _Requirements: 4.1, 4.2, 5.1, 5.3_

- [x] 5. Checkpoint — Core data pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Impact Engine
  - [x] 6.1 Implement `computeBlastRadius` in `src/analysis/impactEngine.ts`
    - Accept `nodeId`, `CallGraph`, and `TestMap`
    - Compute downstream nodes: BFS over `graph.forward` from `nodeId`
    - Compute upstream nodes: BFS over `graph.reverse` from `nodeId`
    - Compute linked tests: filter `TestMap` entries whose function node sets include `nodeId`
    - Compute affected modules: extract first path segment after `src/` from all affected node file paths, deduplicate
    - Compute affected count: size of union of upstream + downstream sets
    - Return `BlastRadiusResult`
    - _Requirements: 5.2, 8.2, 8.6, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2_

  - [ ]\* 6.2 Write unit tests for Impact Engine
    - Create `src/test/analysis/impactEngine.test.ts`
    - Test downstream BFS traversal
    - Test upstream BFS traversal
    - Test linked test file identification
    - Test feature module inference from file paths
    - Test with isolated node (no upstream/downstream)
    - Test affected count calculation
    - _Requirements: 5.2, 8.2, 8.6, 9.2, 9.3, 9.4, 10.1, 10.2_

- [x] 7. Implement Webview Provider and Panel Lifecycle
  - [x] 7.1 Implement `BlastRadiusPanel` in `src/webview/webviewProvider.ts`
    - Create webview panel with title "Blast Radius" and `vscode.ViewColumn.Beside`
    - Set `enableScripts: true` and configure `localResourceRoots` to include `media/` directory
    - Generate HTML content that loads Cytoscape.js and `graph.js` from `media/` folder using webview URIs
    - Implement `show(graph, testMap)`: serialize `CallGraph` and `TestMap` to JSON, send `graph-data` message via `postMessage`
    - Implement `handleNodeClick(nodeId, graph, testMap)`: call `computeBlastRadius`, send `highlight` message via `postMessage`
    - Implement `dispose()`: clean up panel resources
    - Handle incoming `node-click` messages from webview
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 8.1, 8.3, 12.1, 12.2_

  - [x] 7.2 Implement data privacy check
    - At panel initialization, verify no network requests to non-`vscode://` and non-`file://` URIs are configured
    - Throw an error if any external network calls are detected
    - Set Content Security Policy in webview HTML to restrict network access
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 8. Implement Webview Client (Cytoscape.js Rendering)
  - [x] 8.1 Create webview HTML and JavaScript
    - Create `media/graph.html` with container div for Cytoscape.js and Impact Summary sidebar
    - Create `media/graph.js` with Cytoscape.js initialization and message handling
    - Bundle `cytoscape.min.js` and `cytoscape-dagre.js` into `media/` folder
    - _Requirements: 6.1, 6.3_

  - [x] 8.2 Implement graph rendering from `graph-data` messages
    - On receiving `graph-data` message, initialize Cytoscape.js instance with received nodes and edges
    - Use `dagre` layout for hierarchical rendering, fallback to `cose` for dense graphs
    - Style source function nodes as blue circles, test file nodes as green diamonds, feature module nodes as orange rectangles
    - Enable pan, zoom, and fit-to-screen interactions
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 7.2_

  - [x] 8.3 Implement node click handling and highlight application
    - On node click, post `node-click` message to extension host with the clicked node ID
    - On receiving `highlight` message, apply styles: downstream nodes in red, upstream nodes in purple, linked test nodes in green
    - Dim all unrelated nodes to opacity 0.15
    - Highlight the selected node distinctly
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 8.4 Implement Impact Summary sidebar rendering
    - On receiving `highlight` message, populate the Impact Summary section
    - Display count of affected function nodes
    - List recommended Jest test file paths
    - List at-risk feature modules
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9. Wire everything together in the command handler
  - [x] 9.1 Update `src/extension.ts` with the full pipeline
    - Register `blast-radius.open` command replacing the hello world command
    - On command invocation: get workspace root, call `parseProject`, call `buildGraph`, call `buildTestMap`, create `BlastRadiusPanel`, call `panel.show(graph, testMap)`
    - Wire `node-click` messages to `panel.handleNodeClick`
    - Ensure extension activates only on command invocation (lazy activation)
    - Push panel disposable to `context.subscriptions`
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 11.2_

  - [x] 9.2 Implement Call Graph serialization for postMessage transmission
    - Implement serialization: convert `CallGraph` (Maps/Sets) to `SerializedCallGraph` (arrays) for JSON transmission
    - Implement deserialization in webview client: convert received JSON arrays back to renderable graph structure
    - Ensure round-trip fidelity: same nodes and edges after serialize → deserialize
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 10. Checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ]\* 11. Write integration tests for the full pipeline
  - Create `src/test/integration/pipeline.test.ts`
  - Test end-to-end: parse a small fixture project → build graph → build test map → compute blast radius
  - Verify that blast radius results include expected downstream, upstream, and test file sets
  - Verify feature module inference from fixture file paths
  - _Requirements: 2.1, 3.1, 5.1, 5.2, 8.2, 10.1_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major milestones
- The design uses TypeScript throughout — all implementation code is TypeScript (extension host) and JavaScript (webview client)
- Cytoscape.js and cytoscape-dagre are bundled in `media/` for the webview; no runtime network dependencies
- The extension uses the standard VSCode `postMessage` API for host↔webview communication
