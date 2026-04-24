import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";
import { CallGraph, TestMap } from "../types";

export function buildTestMap(workspaceRoot: string, graph: CallGraph): TestMap {
  const mapping = new Map<string, Set<string>>();
  const testFiles = findTestFiles(workspaceRoot);

  for (const testFile of testFiles) {
    const importedNodeIds = extractImports(testFile, workspaceRoot, graph);
    const reachableNodeIds = expandTransitively(importedNodeIds, graph);
    mapping.set(testFile, reachableNodeIds);
  }

  return { mapping };
}

function findTestFiles(workspaceRoot: string): string[] {
  const testFiles: string[] = [];
  
  function walk(dir: string) {
    if (!fs.existsSync(dir)) {
      return;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts"))) {
        testFiles.push(path.relative(workspaceRoot, fullPath));
      }
    }
  }
  
  walk(workspaceRoot);
  return testFiles;
}

function extractImports(testFile: string, workspaceRoot: string, graph: CallGraph): Set<string> {
  const importedNodeIds = new Set<string>();
  const fullPath = path.join(workspaceRoot, testFile);
  
  if (!fs.existsSync(fullPath)) {
    return importedNodeIds;
  }

  const sourceFile = ts.createSourceFile(
    fullPath,
    fs.readFileSync(fullPath, "utf-8"),
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const modulePath = node.moduleSpecifier.text;
      
      if (modulePath.startsWith(".") || modulePath.startsWith("..")) {
        const resolvedPath = resolveImportPath(modulePath, testFile, workspaceRoot);
        
        if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            const symbolName = element.name.text;
            const nodeId = `${resolvedPath}#${symbolName}`;
            if (graph.nodes.has(nodeId)) {
              importedNodeIds.add(nodeId);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return importedNodeIds;
}

function resolveImportPath(modulePath: string, testFile: string, workspaceRoot: string): string {
  const testDir = path.dirname(testFile);
  const resolved = path.normalize(path.join(testDir, modulePath));
  
  if (!resolved.endsWith(".ts")) {
    return resolved + ".ts";
  }
  return resolved;
}

function expandTransitively(startNodes: Set<string>, graph: CallGraph): Set<string> {
  const reachable = new Set<string>(startNodes);
  const queue = Array.from(startNodes);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const callees = graph.forward.get(current);
    
    if (callees) {
      for (const callee of callees) {
        if (!reachable.has(callee)) {
          reachable.add(callee);
          queue.push(callee);
        }
      }
    }
  }

  return reachable;
}
