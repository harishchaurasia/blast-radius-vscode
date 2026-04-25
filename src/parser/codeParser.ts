/**
 * Code Parser — walks the TypeScript AST to extract function definitions and call sites.
 *
 * Uses the TypeScript Compiler API (`ts.createProgram`) to parse all `.ts` files
 * under the workspace `src/` directory. Extracts:
 *   - Named function declarations (`FunctionDeclaration`)
 *   - Arrow functions assigned to `const`/`let` (`VariableDeclaration` with `ArrowFunction`)
 *   - Class methods (`MethodDeclaration`)
 *   - Exported functions (all of the above with `export` modifier)
 *
 * Call edges are resolved via `TypeChecker.getSymbolAtLocation` on `CallExpression` nodes.
 *
 * **Known limitations (skipped dynamic calls):**
 *   - String-keyed property access (e.g. `obj["method"]()`)
 *   - `eval()` invocations
 *   - Framework-injected callbacks (e.g. decorators, DI containers)
 *   - Dynamically computed call targets
 */

import * as ts from "typescript";
import * as path from "path";
import { FunctionNode, CallEdge, ParseResult } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a node ID from a relative file path and symbol name.
 * Format: `{relativePath}#{symbolName}`
 */
function makeNodeId(relativePath: string, symbolName: string): string {
  return `${relativePath}#${symbolName}`;
}

/**
 * Return the name of the enclosing class, or `undefined` if the node is not
 * inside a class declaration.
 */
function getEnclosingClassName(node: ts.Node): string | undefined {
  let current = node.parent;
  while (current) {
    if (ts.isClassDeclaration(current) && current.name) {
      return current.name.text;
    }
    current = current.parent;
  }
  return undefined;
}

/**
 * Check whether a call expression is a dynamic call that should be skipped.
 *
 * Skipped patterns:
 *   - `eval(...)` calls
 *   - String-keyed element access: `obj["method"]()`
 *   - Computed property access where the property is not an identifier
 */
function isDynamicCall(node: ts.CallExpression): boolean {
  const expr = node.expression;

  // eval()
  if (ts.isIdentifier(expr) && expr.text === "eval") {
    return true;
  }

  // obj["method"]() — element access with string literal
  if (ts.isElementAccessExpression(expr)) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// AST Walking
// ---------------------------------------------------------------------------

/**
 * Collect all FunctionNode entries from a single source file.
 */
function collectNodes(
  sourceFile: ts.SourceFile,
  relativePath: string,
): FunctionNode[] {
  const nodes: FunctionNode[] = [];

  function visit(node: ts.Node): void {
    // Named function declarations: `function foo() {}` or `export function foo() {}`
    if (ts.isFunctionDeclaration(node) && node.name) {
      const symbolName = node.name.text;
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      nodes.push({
        id: makeNodeId(relativePath, symbolName),
        filePath: relativePath,
        symbolName,
        startLine: start.line + 1,
        endLine: end.line + 1,
        kind: "function",
      });
    }

    // Arrow functions assigned to const/let:
    // `const foo = () => {}` or `export const foo = () => {}`
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          decl.name &&
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          ts.isArrowFunction(decl.initializer)
        ) {
          const symbolName = decl.name.text;
          const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
          nodes.push({
            id: makeNodeId(relativePath, symbolName),
            filePath: relativePath,
            symbolName,
            startLine: start.line + 1,
            endLine: end.line + 1,
            kind: "arrow",
          });
        }
      }
    }

    // Class methods: `class Foo { bar() {} }`
    if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
      const className = getEnclosingClassName(node);
      if (className) {
        const symbolName = `${className}.${node.name.text}`;
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        nodes.push({
          id: makeNodeId(relativePath, symbolName),
          filePath: relativePath,
          symbolName,
          startLine: start.line + 1,
          endLine: end.line + 1,
          kind: "method",
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return nodes;
}

/**
 * Resolve a CallExpression to the FunctionNode ID of the callee, if possible.
 * Returns `undefined` when the call target cannot be statically resolved.
 */
function resolveCallTarget(
  callExpr: ts.CallExpression,
  checker: ts.TypeChecker,
  workspaceRoot: string,
  sourceFiles: ReadonlyArray<ts.SourceFile>,
): string | undefined {
  const expr = callExpr.expression;

  // Try to get the symbol at the call site
  let symbol = checker.getSymbolAtLocation(expr);
  if (!symbol) {
    return undefined;
  }

  // Follow aliases (e.g. imports)
  if (symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }

  const declarations = symbol.getDeclarations();
  if (!declarations || declarations.length === 0) {
    return undefined;
  }

  const decl = declarations[0];
  const declSourceFile = decl.getSourceFile();

  // Only resolve to files within the workspace
  const declFilePath = path.relative(workspaceRoot, declSourceFile.fileName);
  if (declFilePath.startsWith("..") || path.isAbsolute(declFilePath)) {
    return undefined;
  }

  // Normalize to forward slashes
  const normalizedPath = declFilePath.split(path.sep).join("/");

  // Determine the symbol name based on the declaration kind
  let symbolName: string | undefined;

  if (ts.isFunctionDeclaration(decl) && decl.name) {
    symbolName = decl.name.text;
  } else if (ts.isMethodDeclaration(decl) && decl.name && ts.isIdentifier(decl.name)) {
    const className = getEnclosingClassName(decl);
    if (className) {
      symbolName = `${className}.${decl.name.text}`;
    }
  } else if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
    // Arrow function assigned to a variable
    if (decl.initializer && ts.isArrowFunction(decl.initializer)) {
      symbolName = decl.name.text;
    }
  }

  if (!symbolName) {
    return undefined;
  }

  return makeNodeId(normalizedPath, symbolName);
}

/**
 * Find the enclosing FunctionNode ID for a given AST node.
 * Walks up the parent chain to find the nearest function/method/arrow declaration.
 */
function findEnclosingFunctionId(
  node: ts.Node,
  relativePath: string,
): string | undefined {
  let current = node.parent;
  while (current) {
    // Named function declaration
    if (ts.isFunctionDeclaration(current) && current.name) {
      return makeNodeId(relativePath, current.name.text);
    }

    // Method declaration
    if (
      ts.isMethodDeclaration(current) &&
      current.name &&
      ts.isIdentifier(current.name)
    ) {
      const className = getEnclosingClassName(current);
      if (className) {
        return makeNodeId(relativePath, `${className}.${current.name.text}`);
      }
    }

    // Arrow function assigned to a variable
    if (ts.isArrowFunction(current)) {
      const parent = current.parent;
      if (
        ts.isVariableDeclaration(parent) &&
        ts.isIdentifier(parent.name)
      ) {
        return makeNodeId(relativePath, parent.name.text);
      }
    }

    current = current.parent;
  }
  return undefined;
}

/**
 * Collect all CallEdge entries from a single source file.
 */
function collectEdges(
  sourceFile: ts.SourceFile,
  relativePath: string,
  checker: ts.TypeChecker,
  workspaceRoot: string,
  sourceFiles: ReadonlyArray<ts.SourceFile>,
): CallEdge[] {
  const edges: CallEdge[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      // Skip dynamic calls
      if (!isDynamicCall(node)) {
        const callerId = findEnclosingFunctionId(node, relativePath);
        if (callerId) {
          const calleeId = resolveCallTarget(node, checker, workspaceRoot, sourceFiles);
          if (calleeId) {
            edges.push({ callerId, calleeId });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse all `.ts` files under the given workspace root's `src/` directory.
 *
 * Uses `ts.createProgram` with the workspace `tsconfig.json` to load files
 * with full type information. Walks each source file's AST to extract
 * `FunctionNode` entries and `CallEdge` entries.
 *
 * @param workspaceRoot - Absolute path to the workspace root directory
 * @returns ParseResult containing all discovered nodes and edges
 */
export function parseProject(workspaceRoot: string): ParseResult {
  const tsconfigPath = path.join(workspaceRoot, "tsconfig.json");

  // Read tsconfig.json
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    return { nodes: [], edges: [] };
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    workspaceRoot,
  );

  // Filter to only .ts files under src/
  const srcDir = path.join(workspaceRoot, "src");
  const srcFiles = parsedConfig.fileNames.filter((f) => {
    const normalized = path.resolve(f);
    return normalized.startsWith(srcDir) && normalized.endsWith(".ts");
  });

  if (srcFiles.length === 0) {
    return { nodes: [], edges: [] };
  }

  // Create the program with full type checking
  const program = ts.createProgram(srcFiles, parsedConfig.options);
  const checker = program.getTypeChecker();
  const allSourceFiles = program.getSourceFiles().filter(
    (sf) => !sf.isDeclarationFile,
  );

  const allNodes: FunctionNode[] = [];
  const allEdges: CallEdge[] = [];

  for (const sourceFile of allSourceFiles) {
    const filePath = path.resolve(sourceFile.fileName);

    // Only process files under src/
    if (!filePath.startsWith(srcDir)) {
      continue;
    }

    const relativePath = path
      .relative(workspaceRoot, filePath)
      .split(path.sep)
      .join("/");

    // Collect function nodes
    const nodes = collectNodes(sourceFile, relativePath);
    allNodes.push(...nodes);

    // Collect call edges
    const edges = collectEdges(
      sourceFile,
      relativePath,
      checker,
      workspaceRoot,
      allSourceFiles,
    );
    allEdges.push(...edges);
  }

  return { nodes: allNodes, edges: allEdges };
}
