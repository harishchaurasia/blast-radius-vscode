import * as vscode from "vscode";
import { CallGraph, TestMap, GraphDataMessage, HighlightMessage, NodeClickMessage, SerializedFunctionNode, SerializedCallEdge } from "../types";import { computeBlastRadius } from "../analysis/impactEngine";

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
          localResourceRoots: [
            vscode.Uri.joinPath(this.extensionUri, "media"),
            vscode.Uri.joinPath(this.extensionUri, "node_modules"),
          ],
        }
      );

      this.panel.webview.html = this.getHtmlContent(this.panel.webview);

      this.panel.webview.onDidReceiveMessage((message: NodeClickMessage) => {
        if (message.type === "node-click") {
          this.handleNodeClick(message.nodeId);
        } else if (message.type === "jump-to-source") {
          this.handleJumpToSource(message.nodeId);
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

  private handleJumpToSource(nodeId: string): void {
    const node = this.graph?.nodes.get(nodeId);
    if (!node) { return; }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) { return; }
    const fileUri = vscode.Uri.file(`${workspaceRoot}/${node.filePath}`);
    vscode.window.showTextDocument(fileUri, {
      selection: new vscode.Range(node.startLine - 1, 0, node.startLine - 1, 0),
      viewColumn: vscode.ViewColumn.One,
    });
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
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      position: relative;
      height: 100vh;
      overflow: hidden;
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    /* ── Graph canvas ── */
    #cy-wrap {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    #cy { width: 100%; height: 100%; }

    #empty-graph {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--vscode-descriptionForeground);
      pointer-events: none;
    }
    #empty-graph .empty-icon { font-size: 40px; opacity: 0.3; }
    #empty-graph p { font-size: 13px; }

    /* ── Legend ── */
    #legend {
      position: absolute;
      bottom: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--vscode-sideBar-background);
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid var(--vscode-panel-border);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      font-size: 10px;
      color: var(--vscode-foreground);
      z-index: 50;
    }
    #legend.minimized .legend-columns,
    #legend.minimized #impact-legend { display: none !important; }
    .legend-columns {
      display: flex;
      gap: 16px;
    }
    .legend-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .legend-col-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 2px;
    }
    #legend-toggle {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 0 0 4px 0;
      text-align: left;
    }
    #legend-toggle:hover { color: var(--vscode-textLink-foreground); }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-yellow { background: #f6e05e; }
    .dot-red    { background: #fc8181; }
    .dot-orange { background: #f6ad55; }
    .dot-blue   { background: #76e4f7; }
    .dot-green  { background: #68d391; }

    /* ── Sidebar ── */
    #sidebar {
      position: absolute;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      width: 280px;
      max-height: calc(100vh - 40px);
      display: none;
      flex-direction: column;
      overflow: hidden;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 50;
    }
    #sidebar.visible {
      display: flex;
    }
    #sidebar.visible {
      display: flex;
    }
    #sidebar-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 14px 14px 20px;
    }

    .section { margin-bottom: 18px; }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    /* Epicenter */
    #epicenter-label { display: none; margin-bottom: 14px; }
    #epicenter-name { font-size: 15px; font-weight: 600; color: var(--vscode-foreground); }
    #epicenter-path { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; word-break: break-all; }

    /* Blast summary numbers */
    .blast-row { display: flex; gap: 10px; margin-bottom: 10px; }
    .blast-stat {
      flex: 1;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      padding: 8px 6px;
      text-align: center;
    }
    .blast-stat .num { font-size: 22px; font-weight: 700; color: var(--vscode-textLink-foreground); }
    .blast-stat .lbl { font-size: 9px; color: var(--vscode-descriptionForeground); text-transform: uppercase; margin-top: 2px; }

    /* Impact bar */
    .impact-bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 4px; background: var(--vscode-panel-border); }
    #bar-high   { background: #fc8181; transition: width 0.3s; }
    #bar-medium { background: #f6ad55; transition: width 0.3s; }
    #bar-low    { background: #76e4f7; transition: width 0.3s; }
    #impact-counts { font-size: 10px; color: var(--vscode-descriptionForeground); }

    /* Node lists */
    .list-item {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 5px 6px;
      border-radius: 3px;
      cursor: pointer;
      color: var(--vscode-foreground);
      transition: background 0.1s;
    }
    .list-item:hover { background: var(--vscode-list-hoverBackground); }
    .list-item.muted { color: var(--vscode-descriptionForeground); cursor: default; font-style: italic; }
    .list-item.muted:hover { background: transparent; }
    .item-name { font-weight: 500; flex-shrink: 0; color: var(--vscode-foreground); }
    .item-path { font-size: 10px; color: var(--vscode-descriptionForeground); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item-role { font-size: 9px; color: var(--vscode-descriptionForeground); flex-shrink: 0; }
    .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

    ul { list-style: none; }

    /* Test item */
    .test-item .item-name { color: #68d391; }
    .test-item .item-path {
      display: inline-block;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: none;
    }
    .test-item:hover .item-path {
      animation: scrollText 4s linear infinite;
      text-overflow: clip;
    }
    @keyframes scrollText {
      0%   { transform: translateX(0); }
      10%  { transform: translateX(0); }
      90%  { transform: translateX(calc(-100% + 160px)); }
      100% { transform: translateX(calc(-100% + 160px)); }
    }

    /* Sidebar empty state */
    #sidebar-empty { padding: 20px 14px; color: var(--vscode-descriptionForeground); line-height: 1.6; }
    #sidebar-content { display: none; }

    /* Action buttons */
    .action-btn {
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin-top: 6px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      text-align: center;
      transition: opacity 0.15s;
    }
    .action-btn:hover { opacity: 0.85; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }

    .legend-sep { width: 1px; height: 12px; background: var(--vscode-panel-border); margin: 0 2px; }
    #test-coverage-count { color: #68d391; font-weight: 600; }
  </style>
</head>
<body>

  <!-- Graph -->
  <div id="cy-wrap">
    <div id="cy"></div>
    <div id="empty-graph">
      <div class="empty-icon">⬡</div>
      <p>No graph data — open a TypeScript workspace and run <strong>Blast Radius: Open Graph</strong></p>
    </div>
    <div id="legend">
      <button id="legend-toggle">▾ legend</button>
      <div class="legend-columns">
        <div class="legend-col">
          <div class="legend-col-title">Modules</div>
          <div id="module-legend" style="display:flex;flex-direction:column;gap:4px"></div>
        </div>
        <div class="legend-col" id="shapes-col">
          <div class="legend-col-title">Node Type</div>
          <div id="shapes-legend" style="display:flex;flex-direction:column;gap:4px"></div>
        </div>
      </div>
      <div id="impact-legend" style="display:none;flex-direction:column;gap:4px">
        <div class="legend-col-title">Impact</div>
        <div class="legend-item"><div class="legend-dot dot-yellow"></div> selected</div>
        <div class="legend-item"><div class="legend-dot dot-red"></div> high</div>
        <div class="legend-item"><div class="legend-dot dot-orange"></div> medium</div>
        <div class="legend-item"><div class="legend-dot dot-blue"></div> low</div>
        <div class="legend-item"><div class="legend-dot dot-green"></div> test</div>
        <div style="height:1px;width:100%;background:var(--vscode-panel-border);margin:2px 0"></div>
        <div class="legend-item"><div style="width:18px;height:3px;background:#fc8181;border-radius:2px"></div> callee</div>
        <div class="legend-item"><div style="width:18px;height:3px;background:#63b3ed;border-radius:2px"></div> caller</div>
      </div>
    </div>
  </div>

  <!-- Sidebar -->
  <div id="sidebar">
    <div id="sidebar-scroll">

      <div id="epicenter-label">
        <div class="section-title">Epicenter</div>
        <div id="epicenter-name"></div>
        <div id="epicenter-path"></div>
      </div>

      <div id="sidebar-empty">
        <div class="section-title">Blast Radius</div>
        <p>Click a node to see its impact across the call graph.</p>
      </div>

      <div id="sidebar-content">
        <div class="section">
          <div class="section-title">Blast Summary</div>
          <div class="blast-row">
            <div class="blast-stat"><div class="num" id="count-impacted">0</div><div class="lbl">impacted</div></div>
            <div class="blast-stat"><div class="num" id="count-callers">0</div><div class="lbl">upstream</div></div>
            <div class="blast-stat"><div class="num" id="count-callees">0</div><div class="lbl">downstream</div></div>
          </div>
          <div class="impact-bar">
            <div id="bar-high" style="width:0%"></div>
            <div id="bar-medium" style="width:0%"></div>
            <div id="bar-low" style="width:0%"></div>
          </div>
          <div id="impact-counts"></div>
        </div>

        <div class="section">
          <div class="section-title">Upstream</div>
          <ul id="callers-list"></ul>
        </div>

        <div class="section">
          <div class="section-title">Downstream</div>
          <ul id="callees-list"></ul>
        </div>

        <div class="section">
          <div class="section-title">Test Coverage <span id="test-coverage-count">0</span></div>
          <ul id="test-list"></ul>
        </div>

        <div class="section">
          <div class="section-title">At-Risk Modules</div>
          <ul id="module-list"></ul>
        </div>

        <button class="action-btn btn-primary" id="btn-jump">→ jump to source</button>
        <button class="action-btn btn-secondary" id="btn-reset">reset view</button>
      </div>

    </div>
  </div>

  <script src="${cytoscapeUri}"></script>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
