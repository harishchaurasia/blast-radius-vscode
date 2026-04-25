# Blast Radius

Visualize the blast radius of any code change in a TypeScript project. This VSCode extension parses your TypeScript codebase, builds a call graph, maps test files to source functions, and renders an interactive graph in a webview panel.

## Features

- **Call Graph Visualization** — Parses all TypeScript files under `src/` and renders function call relationships using Cytoscape.js with a hierarchical dagre layout.
- **Blast Radius Analysis** — Click any function node to see its upstream callers (purple), downstream callees (red), and linked test files (green).
- **Impact Summary Sidebar** — Shows affected function count, recommended test files to run, and at-risk feature modules.
- **Test Mapping** — Automatically discovers `*.test.ts` and `*.spec.ts` files and maps them to source functions transitively through the call graph.
- **Data Privacy** — All analysis runs locally. A strict Content Security Policy ensures no data leaves the extension.

### Node Types

| Shape | Color | Meaning |
|-------|-------|---------|
| Circle | Blue | Source function |
| Diamond | Green | Test file |
| Rectangle | Orange | Feature module |

### Highlight Colors (on click)

| Color | Meaning |
|-------|---------|
| Gold | Selected node |
| Red | Downstream (functions called by selected) |
| Purple | Upstream (functions that call selected) |
| Green | Linked test files |
| Dimmed | Unrelated nodes |

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [VSCode](https://code.visualstudio.com/) v1.107.0+ or [Kiro](https://kiro.dev/)

## Setup

```bash
# Clone the repository
git clone https://github.com/harishchaurasia/blast-radius-vscode.git
cd blast-radius-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

## How to Run

### Step 1: Launch the Extension Development Host

1. Open the `blast-radius-vscode` folder in VSCode or Kiro
2. Press **F5** — this compiles the extension and opens a new VSCode window (the Extension Development Host)

### Step 2: Open a TypeScript Project

In the **new Extension Development Host window**:

1. Go to **File → Open Folder**
2. Select any TypeScript project that has a `tsconfig.json` and a `src/` directory
3. Click **Select Folder**

### Step 3: Run the Extension

1. Press **Ctrl+Shift+P** (or **Cmd+Shift+P** on Mac) to open the Command Palette
2. Type `Blast Radius: Open Graph`
3. Press **Enter**

A panel will open beside your editor showing the interactive call graph.

### Step 4: Explore the Graph

- **Pan and zoom** the graph using your mouse
- **Click any node** to see its blast radius — the Impact Summary sidebar will show affected functions, recommended tests, and at-risk modules
- **Click a different node** to update the view

### Step 5: Stop

- Close the Extension Development Host window, or press **Shift+F5** in the original window

## Using the Sample Test Project

A sample TypeScript project is included for testing. If you need one, create it at any location with this structure:

```
test-ts-project/
  tsconfig.json
  src/
    utils/
      math.ts          — add, subtract, multiply, clamp
      formatter.ts     — formatCurrency, formatPercent, truncate
    cart/
      discount.ts      — computeDiscount, applyPromoCode
      cartCalculator.ts — calculateItemTotal, calculateSubtotal, calculateTotal
    order/
      orderValidator.ts — isValidItem, validateCart
      orderService.ts   — OrderService class with createOrder, confirmOrder
    test/
      cartCalculator.test.ts
      orderService.test.ts
```

## Running Tests

```bash
# Run all tests (compiles, lints, then runs test suite)
npm test

# Compile only
npm run compile

# Lint only
npm run lint
```

## Project Structure

```
src/
  extension.ts              — Entry point, registers the blast-radius.open command
  types.ts                  — Core TypeScript interfaces
  parser/
    codeParser.ts           — AST walker that extracts functions and call edges
    testMapper.ts           — Maps test files to source functions transitively
  graph/
    graphBuilder.ts         — Builds the in-memory call graph with adjacency lists
    serialization.ts        — Serializes/deserializes graph data for webview transport
  analysis/
    impactEngine.ts         — BFS-based blast radius computation
  webview/
    webviewProvider.ts      — Manages the webview panel lifecycle and messaging
media/
  graph.js                  — Cytoscape.js client running in the webview
  cytoscape.min.js          — Cytoscape.js library
  cytoscape-dagre.js        — Dagre layout plugin for Cytoscape
  dagre.js                  — Dagre graph layout library
```

## Known Limitations

- Only parses `.ts` files under the `src/` directory
- Skips dynamic calls: `eval()`, string-keyed property access (`obj["method"]()`), framework-injected callbacks
- Namespace imports (`import * as ns`) are not resolved to individual functions
- Requires a `tsconfig.json` at the workspace root

## License

See [LICENSE](LICENSE) for details.
