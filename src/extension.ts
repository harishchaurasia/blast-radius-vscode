/**
 * Blast Radius extension entry point.
 *
 * Registers the `blast-radius.open` command which:
 *   1. Parses the workspace TypeScript project
 *   2. Builds the call graph
 *   3. Maps test files to source functions
 *   4. Opens an interactive Cytoscape.js webview panel
 *   5. Wires node-click events to blast radius computation
 *
 * The extension activates lazily — only when the command is first invoked.
 */

import * as vscode from "vscode";
import { parseProject } from "./parser/codeParser";
import { buildGraph } from "./graph/graphBuilder";
import { buildTestMap } from "./parser/testMapper";
import { BlastRadiusPanel } from "./webview/webviewProvider";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "blast-radius.open",
    () => {
      // 1. Resolve workspace root
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(
          "Blast Radius: No workspace folder is open.",
        );
        return;
      }
      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // 2. Parse the TypeScript project
      const parseResult = parseProject(workspaceRoot);

      // 3. Build the call graph
      const graph = buildGraph(parseResult);

      // 4. Build the test map
      const testMap = buildTestMap(workspaceRoot, graph);

      // 5. Create the webview panel and show the graph
      const panel = new BlastRadiusPanel(context.extensionUri);
      panel.show(graph, testMap);

      // 6. Push disposables to context.subscriptions for cleanup
      context.subscriptions.push(panel);
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
