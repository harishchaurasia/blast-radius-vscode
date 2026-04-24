# Blast Radius — Kiro Spec

## 1. Vision

A VSCode-compatible extension (runs in Kiro, Cursor, VSCode) that visualizes the **blast radius** of any code change. A developer clicks a function, and the extension shows every other function it affects, every Jest test that exercises it, and every feature module at risk — as an interactive graph inside the IDE.

## 2. Problem Statement

In large codebases, developers cannot predict what a code change will break. They respond in two expensive ways:

- **Over-testing:** Running the full CI suite on every change. Wastes compute, delays releases by hours or days.
- **Under-testing:** Running a guessed subset. Ships regressions to production.

Both paths cost enterprises measurable money. Existing tools (Sourcegraph, CodeSee) either require heavyweight cloud setup or focus on navigation rather than change-impact. There is no lightweight, IDE-native tool that answers the single most important question a developer asks before committing: *"If I change this, what breaks?"*

## 3. Track Alignment — Economics (Transparency Guardrail)

The hidden economic factor this exposes: **the true cost of ambiguity in code dependencies.** Teams pay for this in CI minutes, delayed releases, and production incidents — but the cost is invisible at the moment of decision (the commit). Blast Radius surfaces the dependency graph as actionable financial insight: "Run these 12 tests, not all 847. Release risk limited to these 2 features."

## 4. Target User

**Primary:** Senior engineers and tech leads working in TypeScript monorepos with 50+ source files and 50+ Jest tests.

**Secondary:** QA engineers planning regression passes. Release managers gating deployments.

**Anti-persona:** Solo devs on small projects. Tool provides no value below ~30 files.

## 5. Functional Requirements

### 5.1 Code Graph Construction

- MUST parse a TypeScript project rooted at the current VSCode workspace using the TypeScript Compiler API.
- MUST build an in-memory call graph where nodes are functions/methods (qualified by file path + symbol name) and edges are direct call relationships.
- MUST handle: named function declarations, arrow functions assigned to const/let, class methods, exported functions.
- MAY skip: dynamic calls via string keys, eval, framework-injected callbacks (document as known limitation).
- MUST complete parsing for a 100-file project in under 10 seconds.

### 5.2 Test-to-Source Mapping

- MUST parse Jest test files (`*.test.ts`, `*.spec.ts`) in the workspace.
- MUST map each test file to the source modules it imports (direct imports only; transitive imports are resolved via the call graph).
- MUST expose a lookup: given a function node, return the set of test files whose imports reach that node transitively through the call graph.

### 5.3 Visual Graph Panel

- MUST open in a VSCode webview panel titled "Blast Radius."
- MUST render the call graph using Cytoscape.js.
- MUST support pan, zoom, and fit-to-screen.
- MUST visually distinguish node types: source functions, test files, feature modules.
- MUST render on a graph of 200 nodes without dropping below 30fps on typical dev hardware.

### 5.4 Blast Radius Interaction

- On user click of a node in the webview, the extension MUST:
  - Highlight all **downstream** nodes (functions transitively called by this node) in one color.
  - Highlight all **upstream** nodes (functions that transitively call this node) in a second color.
  - Highlight all linked **test nodes** in a third color.
  - Dim all unrelated nodes.
- MUST display an **Impact Summary** sidebar showing:
  - Count of affected functions
  - List of recommended Jest test files to run
  - List of feature modules at risk (inferred from directory structure: top-level folders under `src/` are treated as feature modules unless overridden)

### 5.5 Command & Activation

- MUST register a VSCode command `blast-radius.open` bound to a command palette entry "Blast Radius: Open Graph."
- MUST activate on command invocation (no eager activation — respect startup performance).

### 5.6 Ethics Logic Gate (Out of Track, Included as Defensive Design)

- The extension MUST NOT transmit source code, filenames, or graph data to any external service.
- All analysis runs locally. This is enforced by a hardcoded runtime check at panel initialization that throws if any non-`vscode://` or non-`file://` network call is configured.

## 6. Non-Functional Requirements

- **Performance:** Initial graph build ≤ 10s for 100 files. Click-to-highlight ≤ 200ms.
- **Compatibility:** VSCode 1.80+, Node 18+. Works unchanged in Kiro and Cursor.
- **No external dependencies at runtime:** Cytoscape.js bundled in the webview. No cloud calls.

## 7. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ VSCode Extension Host (extension.ts)                    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │
│  │ Code Parser  │→ │ Graph Builder │→ │ Impact Engine│  │
│  │ (ts-compiler)│  │              │  │             │   │
│  └──────────────┘  └──────────────┘  └──────┬──────┘   │
│                                              │          │
│  ┌──────────────┐                           │          │
│  │ Test Mapper  │───────────────────────────┘          │
│  └──────────────┘                           │          │
│                                              ▼          │
│                                    ┌──────────────────┐ │
│                                    │ Webview Provider │ │
│                                    └────────┬─────────┘ │
└─────────────────────────────────────────────┼───────────┘
                                              │ postMessage
                                              ▼
┌─────────────────────────────────────────────────────────┐
│ Webview (Cytoscape.js)                                  │
│   - Renders graph                                       │
│   - Sends click events back to extension host           │
│   - Receives highlight instructions                     │
└─────────────────────────────────────────────────────────┘
```

## 8. Task Breakdown

### Core (must ship — hours 0-6)

**Task 1: Scaffolding & Command Registration**
- Register `blast-radius.open` command.
- On invocation, create and show a webview panel.
- Render a placeholder "Hello Blast Radius" HTML in the panel.
- Acceptance: Command palette → "Blast Radius: Open Graph" opens a blank panel.

**Task 2: TypeScript Code Parser**
- Module: `src/parser/codeParser.ts`
- Input: workspace root path.
- Output: `CallGraph` object — `{ nodes: FunctionNode[], edges: CallEdge[] }`.
- Uses TypeScript Compiler API to walk all `.ts` files in `src/`, extract function definitions and call sites.
- Acceptance: Given the demo repo, returns a graph with expected function count (verify on 3 sample files).

**Task 3: Jest Test Mapper**
- Module: `src/parser/testMapper.ts`
- Input: workspace root, `CallGraph` from Task 2.
- Output: `TestMap` — `Map<TestFile, Set<FunctionNode>>`.
- Walks `*.test.ts` / `*.spec.ts`, extracts imports, resolves imported symbols to graph nodes, expands via call graph transitively.
- Acceptance: For a known test file that tests `cart.ts`, the map includes `addItem`, `removeItem`, `calculateTotal`.

**Task 4: Webview Graph Rendering**
- Module: `src/webview/graphPanel.ts` + `media/graph.html` + `media/graph.js`.
- Load Cytoscape.js from bundled `media/` folder.
- Receive `CallGraph` + `TestMap` from extension host via `postMessage`.
- Render nodes styled by type (source function / test / module).
- Acceptance: Panel shows interactive graph on the demo repo.

**Task 5: Blast Radius Click Logic**
- On node click in webview, post message to extension host.
- Host computes upstream, downstream, and test sets.
- Posts highlight instructions back to webview.
- Webview applies colors; dims unrelated nodes.
- Renders impact summary in a sidebar div.
- Acceptance: Click `calculateTotal` → downstream highlighted, upstream highlighted, 4 test files recommended, "cart" and "checkout" modules flagged.

### Stretch (hours 6-10, cut without debate if core is not polished)

**Task 6: Git Diff Integration**
- Read `git diff` against HEAD.
- Identify changed functions by line-range overlap with node locations.
- Auto-highlight their combined blast radius on panel open.

**Task 7: "Run Recommended Tests" Button**
- Button in impact summary sidebar.
- Executes `npx jest <recommended-files>` in VSCode terminal.

**Task 8: Feature Module Labeling**
- User configures `.blast-radius.json` with feature-module labels per folder.
- Impact summary shows human-readable feature names.

## 9. Demo Script (for video pitch)

1. Open Kiro in the demo repo (e.g., mock e-commerce app, ~60 files, ~50 tests).
2. Command palette → "Blast Radius: Open Graph." Graph renders.
3. Click `calculateCartTotal`. Graph lights up: 7 downstream functions, 3 upstream callers, 4 test files, 2 features at risk ("cart", "checkout").
4. Cut to narration: "Full test suite — 847 tests, 40 minutes. Blast Radius says run these 4. Here's how much CI time you just saved."
5. Show the impact summary as the closing frame.

## 10. Known Limitations (stated honestly in writeup)

- TypeScript + Jest only. No Python, Go, Rust, etc.
- Static analysis only; dynamic dispatch patterns (string-keyed method calls, DI containers) missed.
- Test mapping is import-based; tests that invoke code through fixtures or globals may be underreported.
- Feature-module inference is directory-based; projects with flat file structures need manual config (Task 8).

## 11. Out of Scope

- Multi-language support.
- Runtime / dynamic analysis.
- Cloud sync, accounts, team features.
- Historical bug correlation or ML-based test prediction.
- Non-Jest test frameworks.
