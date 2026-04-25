/**
 * Test Mapper — discovers Jest test files and maps them to the source
 * function nodes they exercise, resolved transitively through the call graph.
 *
 * Steps:
 *   1. Find all `*.test.ts` and `*.spec.ts` files under the workspace root.
 *   2. Parse each test file's import statements using the TypeScript compiler.
 *   3. Resolve imported symbols to FunctionNode IDs in the CallGraph.
 *   4. Expand each direct import transitively via BFS over `graph.forward`.
 *   5. Return a TestMap: test file path → Set of all reachable FunctionNode IDs.
 */

import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import type { CallGraph, TestMap } from "../types";

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Recursively find all files matching `*.test.ts` or `*.spec.ts` under `dir`.
 */
function findTestFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts"))
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Import resolution
// ---------------------------------------------------------------------------

/**
 * Extract all named and default import specifiers from a source file's
 * import declarations, and resolve them to FunctionNode IDs in the graph.
 *
 * Handles:
 *   - `import { foo, bar } from "./module"`
 *   - `import defaultExport from "./module"`
 *   - `import * as ns from "./module"` (namespace — skipped, too broad)
 */
function resolveImportsToNodeIds(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  workspaceRoot: string,
  graph: CallGraph,
): Set<string> {
  const resolved = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const clause = statement.importClause;
    if (!clause) {
      continue;
    }

    // Collect the import binding nodes to resolve
    const bindingNodes: ts.Node[] = [];

    // Default import: `import foo from "..."`
    if (clause.name) {
      bindingNodes.push(clause.name);
    }

    // Named imports: `import { foo, bar as baz } from "..."`
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const specifier of clause.namedBindings.elements) {
        bindingNodes.push(specifier.name);
      }
    }

    // Namespace imports (`import * as ns`) are skipped — too coarse-grained

    for (const bindingNode of bindingNodes) {
      let symbol = checker.getSymbolAtLocation(bindingNode);
      if (!symbol) {
        continue;
      }

      // Follow re-exports / aliases
      if (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = checker.getAliasedSymbol(symbol);
      }

      const declarations = symbol.getDeclarations();
      if (!declarations || declarations.length === 0) {
        continue;
      }

      const decl = declarations[0];
      const declFile = decl.getSourceFile();
      const declRelPath = path
        .relative(workspaceRoot, declFile.fileName)
        .split(path.sep)
        .join("/");

      // Determine the symbol name from the declaration
      let symbolName: string | undefined;

      if (ts.isFunctionDeclaration(decl) && decl.name) {
        symbolName = decl.name.text;
      } else if (
        ts.isMethodDeclaration(decl) &&
        decl.name &&
        ts.isIdentifier(decl.name)
      ) {
        // ClassName.methodName
        let className: string | undefined;
        let parent: ts.Node = decl.parent;
        while (parent) {
          if (ts.isClassDeclaration(parent) && parent.name) {
            className = parent.name.text;
            break;
          }
          parent = parent.parent;
        }
        if (className) {
          symbolName = `${className}.${decl.name.text}`;
        }
      } else if (
        ts.isVariableDeclaration(decl) &&
        ts.isIdentifier(decl.name) &&
        decl.initializer &&
        ts.isArrowFunction(decl.initializer)
      ) {
        symbolName = decl.name.text;
      }

      if (!symbolName) {
        continue;
      }

      const nodeId = `${declRelPath}#${symbolName}`;
      if (graph.nodes.has(nodeId)) {
        resolved.add(nodeId);
      }
    }
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Transitive expansion
// ---------------------------------------------------------------------------

/**
 * BFS over `graph.forward` starting from each seed node ID.
 * Returns the union of all seed IDs and their transitively reachable callees.
 */
function expandTransitively(
  seeds: Set<string>,
  graph: CallGraph,
): Set<string> {
  const visited = new Set<string>(seeds);
  const queue = Array.from(seeds);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const callees = graph.forward.get(current);
    if (callees) {
      for (const callee of callees) {
        if (!visited.has(callee)) {
          visited.add(callee);
          queue.push(callee);
        }
      }
    }
  }

  return visited;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse all `*.test.ts` and `*.spec.ts` files under `workspaceRoot` and build
 * a transitive test-to-source mapping.
 *
 * For each test file:
 *   1. Resolve its import statements to FunctionNode IDs in the graph.
 *   2. Expand those IDs transitively via the call graph's forward edges.
 *   3. Store the resulting set in the TestMap.
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @param graph         - The fully constructed CallGraph
 * @returns TestMap mapping each test file path to its reachable FunctionNode IDs
 */
export function buildTestMap(
  workspaceRoot: string,
  graph: CallGraph,
): TestMap {
  const mapping = new Map<string, Set<string>>();

  const testFiles = findTestFiles(workspaceRoot);
  if (testFiles.length === 0) {
    return { mapping };
  }

  // Build a minimal TS program over the test files so we can use the type checker
  // for import resolution. We reuse the workspace tsconfig for compiler options.
  const tsconfigPath = path.join(workspaceRoot, "tsconfig.json");
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const compilerOptions =
    configFile.error
      ? {}
      : ts.parseJsonConfigFileContent(configFile.config, ts.sys, workspaceRoot)
          .options;

  const program = ts.createProgram(testFiles, compilerOptions);
  const checker = program.getTypeChecker();

  for (const testFile of testFiles) {
    const sourceFile = program.getSourceFile(testFile);
    if (!sourceFile) {
      mapping.set(
        path.relative(workspaceRoot, testFile).split(path.sep).join("/"),
        new Set(),
      );
      continue;
    }

    const relTestPath = path
      .relative(workspaceRoot, testFile)
      .split(path.sep)
      .join("/");

    // Step 1: resolve direct imports to graph node IDs
    const directImports = resolveImportsToNodeIds(
      sourceFile,
      checker,
      workspaceRoot,
      graph,
    );

    // Step 2: expand transitively through the call graph
    const allReachable = expandTransitively(directImports, graph);

    mapping.set(relTestPath, allReachable);
  }

  return { mapping };
}
