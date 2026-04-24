# Blast Radius

Visualize the blast radius of any code change in your TypeScript projects. Blast Radius builds a static call graph, maps Jest tests to source functions, and renders an interactive dependency graph inside VSCode.

## Features

- **Static Call Graph Analysis**: Automatically parses TypeScript projects using the TypeScript Compiler API to extract function definitions and call relationships
- **Test-to-Source Mapping**: Maps Jest test files to source functions with transitive coverage analysis
- **Interactive Visualization**: Explore your codebase with an interactive Cytoscape.js graph
- **Blast Radius Computation**: Click any function to see:
  - **Downstream** functions (what this function calls) - highlighted in red
  - **Upstream** functions (what calls this function) - highlighted in purple
  - **Linked tests** that exercise this function - highlighted in green
- **Impact Summary**: View affected function count, recommended tests, and at-risk feature modules
- **Data Privacy**: All analysis runs locally - no code leaves your machine

## Usage

1. Open a TypeScript project in VSCode
2. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
3. Run the command: **"Blast Radius: Open Graph"**
4. Click any function node in the graph to see its blast radius
5. Review the Impact Summary sidebar for metrics and recommendations

## Requirements

- TypeScript project with `tsconfig.json`
- Source code in `src/` directory
- Jest test files following `*.test.ts` or `*.spec.ts` naming convention

## How It Works

1. **Parse**: Uses TypeScript Compiler API to walk the AST and extract function definitions and call sites
2. **Build Graph**: Constructs an in-memory call graph with forward and reverse adjacency lists
3. **Map Tests**: Parses test files, resolves imports, and expands coverage transitively
4. **Visualize**: Renders the graph with Cytoscape.js in a webview panel
5. **Analyze**: Computes blast radius on demand using BFS traversal

## Known Limitations

- Dynamic calls (string-keyed property access, `eval`) are not tracked
- Framework-injected callbacks are not resolved
- Only supports TypeScript projects
- Test mapping assumes Jest-style test files

## Extension Settings

This extension does not add any VS Code settings.

## Release Notes

### 0.0.1

Initial release of Blast Radius:
- Static call graph analysis for TypeScript projects
- Jest test-to-source mapping with transitive coverage
- Interactive Cytoscape.js visualization
- Blast radius computation with upstream/downstream analysis
- Impact summary with affected functions, tests, and modules
