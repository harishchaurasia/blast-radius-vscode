/**
 * Blast Radius — Webview Client
 *
 * Runs inside the VSCode webview (browser context). Receives messages from the
 * extension host via postMessage, renders the call graph with Cytoscape.js,
 * and posts node-click events back to the extension host.
 *
 * Script load order (set in webviewProvider.ts):
 *   1. dagre.js
 *   2. cytoscape.min.js
 *   3. cytoscape-dagre.js
 *   4. graph.js  (this file)
 */

// @ts-nocheck — this file runs in the webview, not under the TS compiler

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Register cytoscape-dagre extension
  // ---------------------------------------------------------------------------

  if (typeof cytoscapeDagre !== "undefined") {
    cytoscape.use(cytoscapeDagre);
  }

  // ---------------------------------------------------------------------------
  // VSCode API
  // ---------------------------------------------------------------------------

  /** @type {ReturnType<typeof acquireVsCodeApi>} */
  const vscode = acquireVsCodeApi();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** @type {import('cytoscape').Core | null} */
  let cy = null;

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  /**
   * Handle messages sent from the extension host via panel.webview.postMessage().
   *
   * Supported message types:
   *   - "graph-data": Full graph payload for initial render (task 9.2)
   *   - "highlight":  Blast radius highlight instructions (task 9.3)
   */
  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "graph-data":
        handleGraphData(message);
        break;

      case "highlight":
        handleHighlight(message);
        break;
    }
  });

  // ---------------------------------------------------------------------------
  // graph-data handler (skeleton — full implementation in task 9.2)
  // ---------------------------------------------------------------------------

  /**
   * Initialize (or re-initialize) the Cytoscape instance with the received
   * graph data.
   *
   * @param {object} message - GraphDataMessage from the extension host
   * @param {Array}  message.nodes          - SerializedFunctionNode[]
   * @param {Array}  message.edges          - SerializedCallEdge[]
   * @param {Array}  message.testFiles      - { path, linkedNodeIds }[]
   * @param {Array}  message.featureModules - string[]
   */
  function handleGraphData(message) {
    // Destroy previous instance if it exists
    if (cy) {
      cy.destroy();
      cy = null;
    }

    // Build Cytoscape elements from the message payload
    const elements = buildElements(message);

    // Determine layout: use dagre for hierarchical rendering,
    // fallback to cose for dense graphs (nodes > 100 or edge/node ratio > 3)
    var nodeCount = 0;
    var edgeCount = 0;
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].group === "nodes") {
        nodeCount++;
      } else if (elements[i].group === "edges") {
        edgeCount++;
      }
    }

    var isDense = nodeCount > 100 || (nodeCount > 0 && edgeCount / nodeCount > 3);

    var layoutConfig = isDense
      ? {
          name: "cose",
          animate: false,
          nodeOverlap: 20,
          idealEdgeLength: 80,
          nodeRepulsion: 400000,
        }
      : {
          name: "dagre",
          rankDir: "TB",
          nodeSep: 50,
          edgeSep: 10,
          rankSep: 70,
          animate: false,
        };

    // Initialize Cytoscape on the #cy container
    cy = cytoscape({
      container: document.getElementById("cy"),
      elements: elements,
      style: defaultStyle(),
      layout: layoutConfig,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
      minZoom: 0.1,
      maxZoom: 5,
    });

    // Fit to screen after layout completes
    cy.on("layoutstop", function () {
      cy.fit(undefined, 30);
    });

    // Wire up node click events (task 9.3 will expand this)
    cy.on("tap", "node", onNodeTap);
  }

  // ---------------------------------------------------------------------------
  // highlight handler (skeleton — full implementation in task 9.3)
  // ---------------------------------------------------------------------------

  /**
   * Apply blast radius highlighting to the graph.
   *
   * @param {object} message - HighlightMessage from the extension host
   * @param {string} message.selectedNodeId
   * @param {Array}  message.downstream      - string[]
   * @param {Array}  message.upstream         - string[]
   * @param {Array}  message.linkedTests      - string[]
   * @param {Array}  message.affectedModules  - string[]
   * @param {number} message.affectedCount
   */
  function handleHighlight(message) {
    if (!cy) {
      return;
    }

    // ----- Task 9.3: Apply blast radius highlighting -----

    // 1. Reset all node and edge styles to defaults
    cy.elements().removeStyle();

    // 2. Build lookup sets for quick membership checks
    var downstreamSet = {};
    for (var i = 0; i < message.downstream.length; i++) {
      downstreamSet[message.downstream[i]] = true;
    }

    var upstreamSet = {};
    for (var i = 0; i < message.upstream.length; i++) {
      upstreamSet[message.upstream[i]] = true;
    }

    // Linked test node IDs use the "test:" prefix in the graph
    var linkedTestSet = {};
    for (var i = 0; i < message.linkedTests.length; i++) {
      linkedTestSet["test:" + message.linkedTests[i]] = true;
    }

    var selectedId = message.selectedNodeId;

    // 3. Dim all nodes and edges first
    cy.elements().style({ opacity: 0.15 });

    // 4. Apply highlight colors to relevant nodes
    cy.nodes().forEach(function (node) {
      var id = node.id();

      if (id === selectedId) {
        // Selected node: bright gold with larger size
        node.style({
          "background-color": "#f1c40f",
          "border-width": 3,
          "border-color": "#f39c12",
          width: 40,
          height: 40,
          opacity: 1,
        });
      } else if (downstreamSet[id]) {
        // Downstream nodes: red
        node.style({
          "background-color": "#e74c3c",
          opacity: 1,
        });
      } else if (upstreamSet[id]) {
        // Upstream nodes: purple
        node.style({
          "background-color": "#9b59b6",
          opacity: 1,
        });
      } else if (linkedTestSet[id]) {
        // Linked test nodes: green
        node.style({
          "background-color": "#27ae60",
          opacity: 1,
        });
      }
      // All other nodes remain dimmed at opacity 0.15
    });

    // 5. Restore opacity for edges connecting highlighted nodes
    var highlightedIds = {};
    highlightedIds[selectedId] = true;
    for (var key in downstreamSet) { highlightedIds[key] = true; }
    for (var key in upstreamSet) { highlightedIds[key] = true; }
    for (var key in linkedTestSet) { highlightedIds[key] = true; }

    cy.edges().forEach(function (edge) {
      var srcId = edge.source().id();
      var tgtId = edge.target().id();
      if (highlightedIds[srcId] && highlightedIds[tgtId]) {
        edge.style({ opacity: 1 });
      }
    });

    // ----- Task 9.4: Populate Impact Summary sidebar -----
    updateSidebar(message);
  }

  // ---------------------------------------------------------------------------
  // Sidebar update helper (task 9.4)
  // ---------------------------------------------------------------------------

  /**
   * Populate the Impact Summary sidebar with blast radius data.
   *
   * @param {object} message - HighlightMessage from the extension host
   */
  function updateSidebar(message) {
    // Hide placeholder, show summary
    var placeholder = document.getElementById("placeholder");
    var summary = document.getElementById("summary");
    if (placeholder) {
      placeholder.style.display = "none";
    }
    if (summary) {
      summary.style.display = "block";
    }

    // Set affected function count
    var affectedCount = document.getElementById("affected-count");
    if (affectedCount) {
      affectedCount.textContent = String(message.affectedCount);
    }

    // Populate recommended test file list
    var testList = document.getElementById("test-list");
    if (testList) {
      testList.innerHTML = "";
      for (var i = 0; i < message.linkedTests.length; i++) {
        var li = document.createElement("li");
        li.textContent = message.linkedTests[i];
        testList.appendChild(li);
      }
    }

    // Populate at-risk module list
    var moduleList = document.getElementById("module-list");
    if (moduleList) {
      moduleList.innerHTML = "";
      for (var i = 0; i < message.affectedModules.length; i++) {
        var li = document.createElement("li");
        li.textContent = message.affectedModules[i];
        moduleList.appendChild(li);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Element construction (skeleton — full implementation in task 9.2)
  // ---------------------------------------------------------------------------

  /**
   * Convert the graph-data message payload into Cytoscape elements.
   *
   * @param {object} message - GraphDataMessage
   * @returns {Array} Cytoscape element definitions
   */
  function buildElements(message) {
    const elements = [];

    // Add source function nodes
    for (const node of message.nodes) {
      elements.push({
        group: "nodes",
        data: {
          id: node.id,
          label: node.symbolName,
          filePath: node.filePath,
          kind: node.kind,
          nodeType: "source",
        },
      });
    }

    // Add edges
    for (const edge of message.edges) {
      elements.push({
        group: "edges",
        data: {
          id: edge.callerId + "->" + edge.calleeId,
          source: edge.callerId,
          target: edge.calleeId,
        },
      });
    }

    // Add test file nodes
    for (const testFile of message.testFiles) {
      elements.push({
        group: "nodes",
        data: {
          id: "test:" + testFile.path,
          label: testFile.path.split("/").pop() || testFile.path,
          filePath: testFile.path,
          nodeType: "test",
        },
      });

      // Add edges from test file to linked source nodes
      for (const nodeId of testFile.linkedNodeIds) {
        elements.push({
          group: "edges",
          data: {
            id: "test:" + testFile.path + "->" + nodeId,
            source: "test:" + testFile.path,
            target: nodeId,
          },
        });
      }
    }

    // Add feature module nodes and edges connecting them to source nodes
    if (message.featureModules && message.featureModules.length > 0) {
      for (const moduleName of message.featureModules) {
        elements.push({
          group: "nodes",
          data: {
            id: "module:" + moduleName,
            label: moduleName,
            nodeType: "module",
          },
        });
      }

      // Connect module nodes to source nodes whose filePath belongs to that module
      for (const node of message.nodes) {
        var normalizedPath = node.filePath.replace(/\\/g, "/");
        var moduleMatch = normalizedPath.match(/(?:^|\/)src\/([^/]+)\//);
        if (moduleMatch) {
          var matchedModule = moduleMatch[1];
          // Only add edge if this module is in the featureModules list
          if (message.featureModules.indexOf(matchedModule) !== -1) {
            elements.push({
              group: "edges",
              data: {
                id: "module:" + matchedModule + "->" + node.id,
                source: "module:" + matchedModule,
                target: node.id,
              },
            });
          }
        }
      }
    }

    return elements;
  }

  // ---------------------------------------------------------------------------
  // Default stylesheet (skeleton — full styling in task 9.2)
  // ---------------------------------------------------------------------------

  /**
   * Return the default Cytoscape stylesheet.
   * @returns {Array} Cytoscape style definitions
   */
  function defaultStyle() {
    return [
      // Base node style (source function nodes — blue circles)
      {
        selector: "node",
        style: {
          label: "data(label)",
          "text-valign": "center",
          "text-halign": "center",
          "font-size": "10px",
          color: "#fff",
          "text-outline-width": 1,
          "text-outline-color": "#333",
          "background-color": "#4a90d9",
          shape: "ellipse",
          width: 30,
          height: 30,
        },
      },
      // Source function nodes — blue circles (explicit selector)
      {
        selector: 'node[nodeType = "source"]',
        style: {
          "background-color": "#4a90d9",
          shape: "ellipse",
          width: 30,
          height: 30,
        },
      },
      // Test file nodes — green diamonds
      {
        selector: 'node[nodeType = "test"]',
        style: {
          "background-color": "#27ae60",
          shape: "diamond",
          width: 35,
          height: 35,
        },
      },
      // Feature module nodes — orange rectangles
      {
        selector: 'node[nodeType = "module"]',
        style: {
          "background-color": "#e67e22",
          shape: "rectangle",
          width: 40,
          height: 25,
        },
      },
      // Edge style — gray with arrows
      {
        selector: "edge",
        style: {
          width: 1,
          "line-color": "#666",
          "target-arrow-color": "#666",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          "arrow-scale": 0.8,
        },
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Node click handler (skeleton — full implementation in task 9.3)
  // ---------------------------------------------------------------------------

  /**
   * Handle a tap/click on a graph node. Posts a node-click message back to
   * the extension host.
   *
   * @param {object} event - Cytoscape tap event
   */
  function onNodeTap(event) {
    const node = event.target;
    const nodeId = node.id();

    vscode.postMessage({
      type: "node-click",
      nodeId: nodeId,
    });
  }
})();
