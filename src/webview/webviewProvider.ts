import * as vscode from "vscode";
import { CallGraph, TestMap, GraphDataMessage, HighlightMessage, NodeClickMessage, SerializedFunctionNode, SerializedCallEdge } from "../types";
import { computeBlastRadius } from "../analysis/impactEngine";

export class BlastRadiusPanel {
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;
  private graph: CallGraph | undefined;
  private testMap: TestMap | undefined;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  show(graph: CallGraph, testMap: TestMap): void {
    this.graph = graph;
    this.testMap = testMap;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "blastRadius",
        "Blast Radius",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
        }
      );

      this.panel.webview.html = this.getHtmlContent(this.panel.webview);

      this.panel.webview.onDidReceiveMessage((message: NodeClickMessage) => {
        if (message.type === "node-click") {
          this.handleNodeClick(message.nodeId);
        }
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.sendGraphData();
  }

  handleNodeClick(nodeId: string): void {
    if (!this.graph || !this.testMap) {
      return;
    }

    const result = computeBlastRadius(nodeId, this.graph, this.testMap);

    const message: HighlightMessage = {
      type: "highlight",
      selectedNodeId: result.selectedNodeId,
      downstream: Array.from(result.downstream),
      upstream: Array.from(result.upstream),
      linkedTests: result.linkedTests,
      affectedModules: result.affectedModules,
      affectedCount: result.affectedCount,
    };

    this.panel?.webview.postMessage(message);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private sendGraphData(): void {
    if (!this.graph || !this.testMap || !this.panel) {
      return;
    }

    const nodes: SerializedFunctionNode[] = Array.from(this.graph.nodes.values());
    const edges: SerializedCallEdge[] = [];

    for (const [callerId, callees] of this.graph.forward.entries()) {
      for (const calleeId of callees) {
        edges.push({ callerId, calleeId });
      }
    }

    const testFiles = Array.from(this.testMap.mapping.entries()).map(([path, linkedNodeIds]) => ({
      path,
      linkedNodeIds: Array.from(linkedNodeIds),
    }));

    const featureModules = this.extractFeatureModules();

    const message: GraphDataMessage = {
      type: "graph-data",
      nodes,
      edges,
      testFiles,
      featureModules,
    };

    this.panel.webview.postMessage(message);
  }

  private extractFeatureModules(): string[] {
    if (!this.graph) {
      return [];
    }

    const modules = new Set<string>();
    for (const node of this.graph.nodes.values()) {
      const parts = node.filePath.split("/");
      const srcIndex = parts.indexOf("src");
      if (srcIndex !== -1 && srcIndex + 1 < parts.length) {
        modules.add(parts[srcIndex + 1]);
      }
    }

    return Array.from(modules);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const cytoscapeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "cytoscape", "dist", "cytoscape.min.js")
    );
    const dagreUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "cytoscape-dagre", "cytoscape-dagre.js")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "graph.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
  <title>Blast Radius</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      height: 100vh;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    #cy {
      flex: 1;
      height: 100%;
    }
    #sidebar {
      width: 300px;
      padding: 20px;
      overflow-y: auto;
      background-color: var(--vscode-sideBar-background);
      border-left: 1px solid var(--vscode-sideBar-border);
    }
    h2 {
      margin-top: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .section {
      margin-bottom: 20px;
    }
    .count {
      font-size: 24px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }
    li {
      padding: 4px 0;
      font-size: 12px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div id="cy"></div>
  <div id="sidebar">
    <div class="section">
      <h2>Impact Summary</h2>
      <div id="summary">Click a node to see impact</div>
    </div>
    <div class="section">
      <h2>Affected Functions</h2>
      <div class="count" id="affected-count">0</div>
    </div>
    <div class="section">
      <h2>Recommended Tests</h2>
      <ul id="test-list"></ul>
    </div>
    <div class="section">
      <h2>At-Risk Modules</h2>
      <ul id="module-list"></ul>
    </div>
  </div>
  <script src="${cytoscapeUri}"></script>
  <script src="${dagreUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
