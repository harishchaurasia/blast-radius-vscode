import * as vscode from "vscode";
import { parseProject } from "./parser/codeParser";
import { buildGraph } from "./graph/graphBuilder";
import { buildTestMap } from "./parser/testMapper";
import { BlastRadiusPanel } from "./webview/webviewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("Blast Radius extension is now active.");

  const disposable = vscode.commands.registerCommand("blast-radius.open", async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace folder open");
      return;
    }

    vscode.window.showInformationMessage("Building call graph...");

    try {
      const parseResult = parseProject(workspaceRoot);
      const graph = buildGraph(parseResult);
      const testMap = buildTestMap(workspaceRoot, graph);

      const panel = new BlastRadiusPanel(context.extensionUri);
      panel.show(graph, testMap);

      context.subscriptions.push({
        dispose: () => panel.dispose(),
      });

      vscode.window.showInformationMessage(
        `Graph built: ${graph.nodes.size} nodes, ${parseResult.edges.length} edges`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to build graph: ${error}`);
      console.error(error);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
