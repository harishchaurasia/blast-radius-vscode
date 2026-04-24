# Blast Radius - Quick Reference

## Command

```
Blast Radius: Open Graph
```

## Color Coding

| Color | Meaning |
|-------|---------|
| 🔵 Blue | Function nodes (source code) |
| 🟢 Green | Test file nodes |
| 🟠 Orange | Selected node |
| 🔴 Red | Downstream (functions called by selected) |
| 🟣 Purple | Upstream (functions that call selected) |
| 🟢 Bright Green | Linked tests (tests that exercise selected) |
| ⚪ Dimmed | Unrelated nodes |

## Project Structure

```
your-project/
├── tsconfig.json          # Required
├── src/                   # Required
│   ├── module1/
│   │   ├── file1.ts
│   │   └── file1.test.ts  # Optional
│   └── module2/
│       ├── file2.ts
│       └── file2.spec.ts  # Optional
```

## Key Concepts

### Function Node
- Represents a function, arrow function, or class method
- ID format: `{filePath}#{symbolName}`
- Example: `src/cart/calc.ts#calculateTotal`

### Call Edge
- Represents a direct function call
- Direction: caller → callee

### Blast Radius
- **Downstream**: All functions transitively called by selected function
- **Upstream**: All functions that transitively call selected function
- **Linked Tests**: Test files that import and exercise selected function

### Feature Module
- Top-level directory under `src/`
- Example: `src/cart/` → module name is "cart"

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Extension Host (Node.js)                 │
├─────────────────────────────────────────────────────────────┤
│  Command Handler                                             │
│      ↓                                                       │
│  Code Parser (TypeScript Compiler API)                       │
│      ↓                                                       │
│  Graph Builder (Adjacency Lists)                             │
│      ↓                                                       │
│  Test Mapper (Import Resolution + BFS)                       │
│      ↓                                                       │
│  Webview Provider (Serialization + postMessage)              │
└─────────────────────────────────────────────────────────────┘
                           ↓ postMessage
┌─────────────────────────────────────────────────────────────┐
│                     Webview Panel (Browser)                  │
├─────────────────────────────────────────────────────────────┤
│  Cytoscape.js Renderer                                       │
│      ↓                                                       │
│  User clicks node                                            │
│      ↓ postMessage                                           │
│  Impact Engine computes blast radius                         │
│      ↓ postMessage                                           │
│  Apply highlights + update sidebar                           │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── types.ts                    # Core interfaces
├── extension.ts                # Command registration
├── parser/
│   ├── codeParser.ts          # TypeScript AST parsing
│   └── testMapper.ts          # Test file mapping
├── graph/
│   └── graphBuilder.ts        # Call graph construction
├── analysis/
│   └── impactEngine.ts        # Blast radius computation
└── webview/
    └── webviewProvider.ts     # Webview panel management

media/
└── graph.js                   # Cytoscape.js client
```

## API Overview

### parseProject(workspaceRoot: string): ParseResult
- Parses all `.ts` files in `src/`
- Returns nodes and edges

### buildGraph(parseResult: ParseResult): CallGraph
- Constructs adjacency list representation
- Returns graph with forward/reverse maps

### buildTestMap(workspaceRoot: string, graph: CallGraph): TestMap
- Finds test files
- Maps tests to source functions transitively

### computeBlastRadius(nodeId: string, graph: CallGraph, testMap: TestMap): BlastRadiusResult
- Computes downstream (BFS forward)
- Computes upstream (BFS reverse)
- Finds linked tests
- Extracts affected modules

## Message Protocol

### Extension → Webview

**graph-data**
```typescript
{
  type: "graph-data",
  nodes: SerializedFunctionNode[],
  edges: SerializedCallEdge[],
  testFiles: { path: string, linkedNodeIds: string[] }[],
  featureModules: string[]
}
```

**highlight**
```typescript
{
  type: "highlight",
  selectedNodeId: string,
  downstream: string[],
  upstream: string[],
  linkedTests: string[],
  affectedModules: string[],
  affectedCount: number
}
```

### Webview → Extension

**node-click**
```typescript
{
  type: "node-click",
  nodeId: string
}
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Graph construction (100 files) | < 10 seconds |
| Blast radius computation | < 200 milliseconds |
| Graph rendering (200 nodes) | 30+ FPS |

## Limitations

- ❌ Dynamic calls (string keys, eval)
- ❌ Framework-injected callbacks
- ❌ Non-TypeScript projects
- ❌ Test files outside Jest conventions

## Development Commands

```bash
# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint

# Test
npm test

# Launch Extension Development Host
Press F5 in VSCode
```

## Debugging Tips

1. **Check Debug Console** for error messages
2. **Set breakpoints** in TypeScript source
3. **Verify tsconfig.json** includes source files
4. **Check src/ directory** exists
5. **Verify test file naming** (*.test.ts or *.spec.ts)

## Resources

- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Requirements](./kiro/specs/blast-radius/requirements.md)
- [Design](./kiro/specs/blast-radius/design.md)
