import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { FunctionNode, CallEdge, ParseResult } from "../types";

export function parseProject(workspaceRoot: string): ParseResult {
  const nodes: FunctionNode[] = [];
  const edges: CallEdge[] = [];
  const srcPath = path.join(workspaceRoot, "src");
  
  if (!fs.existsSync(srcPath)) {
    return { nodes, edges };
  }

  const tsConfigPath = path.join(workspaceRoot, "tsconfig.json");
  const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    workspaceRoot
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames.filter(f => f.includes("/src/") && f.endsWith(".ts")),
    options: parsedConfig.options,
  });

  const checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.includes("/src/") || sourceFile.isDeclarationFile) {
      continue;
    }

    const relativePath = path.relative(workspaceRoot, sourceFile.fileName);
    visitNode(sourceFile, relativePath, nodes, edges, checker, workspaceRoot);
  }

  return { nodes, edges };
}

function visitNode(
  node: ts.Node,
  filePath: string,
  nodes: FunctionNode[],
  edges: CallEdge[],
  checker: ts.TypeChecker,
  workspaceRoot: string,
  currentFunctionId?: string
): void {
  if (ts.isFunctionDeclaration(node) && node.name) {
    const functionNode = createFunctionNode(node, filePath, node.name.text, "function");
    nodes.push(functionNode);
    ts.forEachChild(node, child => visitNode(child, filePath, nodes, edges, checker, workspaceRoot, functionNode.id));
  } else if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        if (ts.isArrowFunction(declaration.initializer) && ts.isIdentifier(declaration.name)) {
          const functionNode = createFunctionNode(declaration.initializer, filePath, declaration.name.text, "arrow");
          nodes.push(functionNode);
          ts.forEachChild(declaration.initializer, child => visitNode(child, filePath, nodes, edges, checker, workspaceRoot, functionNode.id));
        }
      }
    }
  } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
    const className = getClassName(node);
    const methodName = className ? `${className}.${node.name.text}` : node.name.text;
    const functionNode = createFunctionNode(node, filePath, methodName, "method");
    nodes.push(functionNode);
    ts.forEachChild(node, child => visitNode(child, filePath, nodes, edges, checker, workspaceRoot, functionNode.id));
  } else if (ts.isCallExpression(node) && currentFunctionId) {
    const calleeId = resolveCallExpression(node, checker, workspaceRoot);
    if (calleeId) {
      edges.push({ callerId: currentFunctionId, calleeId });
    }
    ts.forEachChild(node, child => visitNode(child, filePath, nodes, edges, checker, workspaceRoot, currentFunctionId));
  } else {
    ts.forEachChild(node, child => visitNode(child, filePath, nodes, edges, checker, workspaceRoot, currentFunctionId));
  }
}

function createFunctionNode(
  node: ts.FunctionDeclaration | ts.ArrowFunction | ts.MethodDeclaration,
  filePath: string,
  symbolName: string,
  kind: "function" | "arrow" | "method"
): FunctionNode {
  const sourceFile = node.getSourceFile();
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  
  return {
    id: `${filePath}#${symbolName}`,
    filePath,
    symbolName,
    startLine: start.line + 1,
    endLine: end.line + 1,
    kind,
  };
}

function getClassName(node: ts.Node): string | undefined {
  let parent = node.parent;
  while (parent) {
    if (ts.isClassDeclaration(parent) && parent.name) {
      return parent.name.text;
    }
    parent = parent.parent;
  }
  return undefined;
}

function resolveCallExpression(
  node: ts.CallExpression,
  checker: ts.TypeChecker,
  workspaceRoot: string
): string | undefined {
  if (ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }

  if (ts.isIdentifier(node.expression)) {
    const symbol = checker.getSymbolAtLocation(node.expression);
    if (!symbol || !symbol.declarations || symbol.declarations.length === 0) {
      return undefined;
    }

    const declaration = symbol.declarations[0];
    const sourceFile = declaration.getSourceFile();
    
    if (sourceFile.isDeclarationFile || !sourceFile.fileName.includes("/src/")) {
      return undefined;
    }

    const relativePath = path.relative(workspaceRoot, sourceFile.fileName);
    const symbolName = symbol.getName();
    
    if (ts.isFunctionDeclaration(declaration) || ts.isVariableDeclaration(declaration)) {
      return `${relativePath}#${symbolName}`;
    } else if (ts.isMethodDeclaration(declaration)) {
      const className = getClassName(declaration);
      const methodName = className ? `${className}.${symbolName}` : symbolName;
      return `${relativePath}#${methodName}`;
    }
  }

  return undefined;
}
