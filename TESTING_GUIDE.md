# Testing Guide for Blast Radius Extension

## Quick Start Testing

### 1. Test with the Example Project

An example TypeScript project is included in the `example/` directory:

```
example/
├── src/
│   ├── order.ts          # Sample TypeScript code with functions
│   └── order.test.ts     # Sample Jest test file
└── tsconfig.json         # TypeScript configuration
```

**To test:**

1. Press `F5` in VSCode to launch the Extension Development Host
2. In the new window, open the `example/` folder
3. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
4. Run: **"Blast Radius: Open Graph"**
5. You should see a graph with:
   - Function nodes: `calculateTotal`, `applyDiscount`, `processOrder`, `OrderProcessor.processItems`, `OrderProcessor.finalizeOrder`
   - Call edges showing relationships
   - Test file node: `order.test.ts`
6. Click on `processOrder` to see:
   - **Downstream** (red): `calculateTotal`, `applyDiscount`
   - **Upstream** (purple): `OrderProcessor.finalizeOrder`
   - **Linked tests** (green): `order.test.ts`

### 2. Test with Your Own Project

1. Open any TypeScript project with:
   - A `tsconfig.json` file
   - Source code in `src/` directory
   - Test files matching `*.test.ts` or `*.spec.ts`
2. Run the command: **"Blast Radius: Open Graph"**
3. Explore the call graph and click nodes to see blast radius

## Expected Behavior

### Graph Rendering
- ✅ Blue circles: Function nodes
- ✅ Green diamonds: Test file nodes
- ✅ Arrows: Call relationships
- ✅ Pan and zoom work smoothly
- ✅ Layout is hierarchical (dagre)

### Node Click Interaction
- ✅ Clicking a function highlights:
  - Selected node in orange
  - Downstream functions in red
  - Upstream functions in purple
  - Linked tests in green
  - All other nodes dimmed (opacity 0.15)

### Impact Summary Sidebar
- ✅ Shows selected function name
- ✅ Displays affected function count
- ✅ Lists recommended test files
- ✅ Lists at-risk feature modules

## Troubleshooting

### "No workspace folder open"
- Make sure you have a folder open in VSCode
- The folder should contain a TypeScript project

### "Failed to build graph"
- Check that `tsconfig.json` exists in the workspace root
- Verify that `src/` directory exists
- Check the Debug Console for detailed error messages

### Graph is empty
- Ensure your TypeScript files are in the `src/` directory
- Check that functions are exported or declared at module level
- Verify that `tsconfig.json` includes the source files

### Test files not showing
- Test files must match `*.test.ts` or `*.spec.ts` pattern
- Test files must import functions from source files
- Imports must use relative paths (e.g., `./order`)

## Performance Testing

Test the extension with projects of varying sizes:

- **Small** (< 50 files): Should be instant
- **Medium** (50-200 files): Should complete in < 5 seconds
- **Large** (200+ files): Should complete in < 10 seconds

If performance is slow, check:
- Number of files being parsed
- Complexity of the call graph
- Number of test files

## Manual Verification Checklist

- [ ] Extension activates on command invocation
- [ ] Graph renders with correct nodes and edges
- [ ] Node click triggers blast radius computation
- [ ] Highlight colors are correct (red, purple, green, orange)
- [ ] Impact summary updates on node click
- [ ] Pan and zoom work smoothly
- [ ] No console errors in Debug Console
- [ ] No network requests (data privacy)
- [ ] Extension works in VSCode, Kiro, and Cursor

## Debugging

To debug the extension:

1. Set breakpoints in the TypeScript source files
2. Press `F5` to launch Extension Development Host
3. Trigger the command
4. Debugger will pause at breakpoints
5. Check variables and call stack

Common debugging points:
- `src/extension.ts`: Command handler
- `src/parser/codeParser.ts`: AST parsing
- `src/graph/graphBuilder.ts`: Graph construction
- `src/analysis/impactEngine.ts`: Blast radius computation
- `src/webview/webviewProvider.ts`: Webview communication

## Known Issues

1. **Dynamic calls not tracked**: Functions called via string keys or `eval` won't appear in the graph
2. **Framework callbacks not resolved**: React hooks, Express middleware, etc. may not be fully tracked
3. **Large projects may be slow**: Projects with 500+ files may take 10+ seconds to parse

## Next Steps

After verifying the extension works:

1. Test with real-world TypeScript projects
2. Gather feedback on usability
3. Optimize performance for large codebases
4. Add unit tests for core modules
5. Package and publish to VSCode marketplace

## Support

If you encounter issues:
1. Check the Debug Console for error messages
2. Verify your project structure matches requirements
3. Try the example project first to isolate issues
4. Review the implementation summary in `IMPLEMENTATION_SUMMARY.md`
