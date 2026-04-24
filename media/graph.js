(function () {
  const vscode = acquireVsCodeApi();
  let cy;

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "graph-data") {
      initializeGraph(message);
    } else if (message.type === "highlight") {
      applyHighlight(message);
    }
  });

  function initializeGraph(data) {
    const elements = [];

    for (const node of data.nodes) {
      elements.push({
        data: {
          id: node.id,
          label: node.symbolName,
          type: "function",
        },
      });
    }

    for (const edge of data.edges) {
      elements.push({
        data: {
          id: `${edge.callerId}-${edge.calleeId}`,
          source: edge.callerId,
          target: edge.calleeId,
        },
      });
    }

    for (const testFile of data.testFiles) {
      elements.push({
        data: {
          id: testFile.path,
          label: testFile.path.split("/").pop(),
          type: "test",
        },
      });

      for (const nodeId of testFile.linkedNodeIds) {
        elements.push({
          data: {
            id: `${testFile.path}-${nodeId}`,
            source: testFile.path,
            target: nodeId,
          },
        });
      }
    }

    cy = cytoscape({
      container: document.getElementById("cy"),
      elements: elements,
      style: [
        {
          selector: "node[type='function']",
          style: {
            "background-color": "#3498db",
            label: "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": "10px",
            color: "#fff",
            "text-outline-width": 2,
            "text-outline-color": "#3498db",
            width: 30,
            height: 30,
          },
        },
        {
          selector: "node[type='test']",
          style: {
            "background-color": "#2ecc71",
            label: "data(label)",
            shape: "diamond",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": "10px",
            color: "#fff",
            "text-outline-width": 2,
            "text-outline-color": "#2ecc71",
            width: 30,
            height: 30,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#95a5a6",
            "target-arrow-color": "#95a5a6",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
        {
          selector: ".selected",
          style: {
            "background-color": "#f39c12",
            "line-color": "#f39c12",
            "target-arrow-color": "#f39c12",
            "border-width": 3,
            "border-color": "#f39c12",
          },
        },
        {
          selector: ".downstream",
          style: {
            "background-color": "#e74c3c",
            "line-color": "#e74c3c",
            "target-arrow-color": "#e74c3c",
          },
        },
        {
          selector: ".upstream",
          style: {
            "background-color": "#9b59b6",
            "line-color": "#9b59b6",
            "target-arrow-color": "#9b59b6",
          },
        },
        {
          selector: ".linked-test",
          style: {
            "background-color": "#27ae60",
            "line-color": "#27ae60",
            "target-arrow-color": "#27ae60",
          },
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.15,
          },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "TB",
        nodeSep: 50,
        rankSep: 100,
      },
    });

    cy.on("tap", "node", (event) => {
      const nodeId = event.target.id();
      vscode.postMessage({
        type: "node-click",
        nodeId: nodeId,
      });
    });

    cy.fit();
  }

  function applyHighlight(data) {
    cy.elements().removeClass("selected downstream upstream linked-test dimmed");

    const selectedNode = cy.getElementById(data.selectedNodeId);
    selectedNode.addClass("selected");

    for (const nodeId of data.downstream) {
      cy.getElementById(nodeId).addClass("downstream");
    }

    for (const nodeId of data.upstream) {
      cy.getElementById(nodeId).addClass("upstream");
    }

    for (const testPath of data.linkedTests) {
      cy.getElementById(testPath).addClass("linked-test");
    }

    const highlightedIds = new Set([
      data.selectedNodeId,
      ...data.downstream,
      ...data.upstream,
      ...data.linkedTests,
    ]);

    cy.nodes().forEach((node) => {
      if (!highlightedIds.has(node.id())) {
        node.addClass("dimmed");
      }
    });

    cy.edges().forEach((edge) => {
      const sourceId = edge.source().id();
      const targetId = edge.target().id();
      if (!highlightedIds.has(sourceId) || !highlightedIds.has(targetId)) {
        edge.addClass("dimmed");
      }
    });

    document.getElementById("summary").textContent = `Selected: ${data.selectedNodeId.split("#")[1]}`;
    document.getElementById("affected-count").textContent = data.affectedCount;

    const testList = document.getElementById("test-list");
    testList.innerHTML = "";
    for (const test of data.linkedTests) {
      const li = document.createElement("li");
      li.textContent = test;
      testList.appendChild(li);
    }

    const moduleList = document.getElementById("module-list");
    moduleList.innerHTML = "";
    for (const module of data.affectedModules) {
      const li = document.createElement("li");
      li.textContent = module;
      moduleList.appendChild(li);
    }
  }
})();
