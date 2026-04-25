(function () {
  // ── Environment detection ──
  // In VS Code webview: acquireVsCodeApi exists. In browser dev mode: it doesn't.
  var IS_DEV = typeof acquireVsCodeApi === "undefined";

  var vscodeApi = IS_DEV
    ? { postMessage: function (msg) { console.log("[dev postMessage]", msg); handleDevMessage(msg); } }
    : acquireVsCodeApi();

  var cy;
  var allData = null;
  var selectedNodeId = null;
  var searchIndex = null;

  // In VS Code, data arrives via postMessage. In dev mode, we load mock data on init.
  window.addEventListener("message", function (event) {
    var message = event.data;
    if (message.type === "graph-data") {
      allData = message;
      searchIndex = SearchEngine.buildSearchIndex(message);
      initializeGraph(message);
      updateEmptyState();
    } else if (message.type === "highlight") {
      applyHighlight(message);
    }
  });

  // Dev mode: load mock data immediately once DOM is ready
  if (IS_DEV) {
    window.addEventListener("DOMContentLoaded", function () {
      if (typeof MOCK_GRAPH_DATA !== "undefined") {
        allData = MOCK_GRAPH_DATA;
        searchIndex = SearchEngine.buildSearchIndex(MOCK_GRAPH_DATA);
        initializeGraph(MOCK_GRAPH_DATA);
        updateEmptyState();
      }
    });
  }

  // Dev mode: simulate backend highlight response on node click
  function handleDevMessage(msg) {
    if (msg.type === "node-click") {
      if (typeof MOCK_HIGHLIGHTS !== "undefined" && MOCK_HIGHLIGHTS[msg.nodeId]) {
        applyHighlight(MOCK_HIGHLIGHTS[msg.nodeId]);
      } else {
        applyHighlight(generateDevHighlight(msg.nodeId));
      }
    }
  }

  function generateDevHighlight(nodeId) {
    if (!cy) { return { type: "highlight", selectedNodeId: nodeId, downstream: [], upstream: [], linkedTests: [], affectedModules: [], affectedCount: 0 }; }
    // Walk edges to find direct downstream/upstream
    var downstream = [];
    var upstream = [];
    cy.edges().forEach(function (edge) {
      if (edge.source().id() === nodeId) { downstream.push(edge.target().id()); }
      if (edge.target().id() === nodeId) { upstream.push(edge.source().id()); }
    });
    // Find linked tests
    var linkedTests = [];
    if (allData && allData.testFiles) {
      for (var i = 0; i < allData.testFiles.length; i++) {
        if (allData.testFiles[i].linkedNodeIds.indexOf(nodeId) !== -1) {
          linkedTests.push(allData.testFiles[i].path);
        }
      }
    }
    // Extract modules
    var allIds = [nodeId].concat(downstream).concat(upstream);
    var moduleSet = {};
    for (var j = 0; j < allIds.length; j++) {
      var parts = allIds[j].split("#")[0].split("/");
      var srcIdx = parts.indexOf("src");
      if (srcIdx !== -1 && srcIdx + 1 < parts.length) { moduleSet[parts[srcIdx + 1]] = true; }
    }
    return {
      type: "highlight",
      selectedNodeId: nodeId,
      downstream: downstream,
      upstream: upstream,
      linkedTests: linkedTests,
      affectedModules: Object.keys(moduleSet),
      affectedCount: downstream.length + upstream.length,
    };
  }

  function getTextColor() {
    return getComputedStyle(document.body).getPropertyValue("--vscode-foreground").trim() || "#ccc";
  }

  function getOutlineColor() {
    return getComputedStyle(document.body).getPropertyValue("--vscode-editor-background").trim() || "#1e1e1e";
  }

  function initializeGraph(data) {
    const elements = buildElements(data);

    cy = cytoscape({
      container: document.getElementById("cy"),
      elements,
      style: buildStylesheet(),
      layout: { name: "preset" },
      minZoom: 0.1,
      maxZoom: 4,
    });

    cy.on("tap", "node", (event) => {
      const node = event.target;
      const nodeType = node.data("type");
      if (nodeType !== "function") { return; }
      const nodeId = node.id();
      selectedNodeId = nodeId;
      vscodeApi.postMessage({ type: "node-click", nodeId: nodeId });
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        resetHighlight();
      }
    });

    // Show label on hover for function and test nodes
    cy.on("mouseover", "node[type='function'], node[type='test']", function (event) {
      var node = event.target;
      if (!node.data("impactLevel") || node.data("impactLevel") === "none" || node.data("impactLevel") === "dimmed") {
        node.style("label", node.data("label"));
      }
    });
    cy.on("mouseout", "node[type='function'], node[type='test']", function (event) {
      var node = event.target;
      var impact = node.data("impactLevel");
      if (!impact || impact === "none" || impact === "dimmed") {
        node.style("label", "");
      }
    });

    runLayout();
    buildModuleLegend();
    populateStatsBar(data);
  }
  // ── Module color palette ──
  // Distinct, readable colors for up to 10 modules. Wraps around if more.
  var MODULE_COLORS = [
    { bg: "#4299e1", border: "#63b3ed" },  // blue
    { bg: "#ed8936", border: "#f6ad55" },  // orange
    { bg: "#9f7aea", border: "#b794f4" },  // purple
    { bg: "#e53e3e", border: "#fc8181" },  // red
    { bg: "#38b2ac", border: "#4fd1c5" },  // teal
    { bg: "#d69e2e", border: "#ecc94b" },  // yellow
    { bg: "#dd6b20", border: "#ed8936" },  // dark orange
    { bg: "#3182ce", border: "#63b3ed" },  // darker blue
    { bg: "#805ad5", border: "#9f7aea" },  // darker purple
    { bg: "#e53e3e", border: "#feb2b2" },  // pink-red
  ];

  function getModuleFromPath(filePath) {
    var parts = filePath.split("/");
    var srcIdx = parts.indexOf("src");
    if (srcIdx !== -1 && srcIdx + 1 < parts.length) {
      return parts[srcIdx + 1];
    }
    // Fallback: use the directory name or file itself
    return parts.length > 1 ? parts[parts.length - 2] : "root";
  }

  function buildElements(data) {
    var elements = [];

    // Collect all modules to assign stable color indices
    var moduleSet = {};
    for (var n = 0; n < data.nodes.length; n++) {
      moduleSet[getModuleFromPath(data.nodes[n].filePath)] = true;
    }
    var moduleList = Object.keys(moduleSet).sort();
    var moduleColorIndex = {};
    for (var m = 0; m < moduleList.length; m++) {
      moduleColorIndex[moduleList[m]] = m % MODULE_COLORS.length;
    }

    // Test file nodes
    for (var t = 0; t < data.testFiles.length; t++) {
      var testFile = data.testFiles[t];
      var tmod2 = getModuleFromPath(testFile.path);
      elements.push({
        data: {
          id: testFile.path,
          label: testFile.path.split("/").pop(),
          filePath: testFile.path,
          type: "test",
          module: tmod2,
          impactLevel: "none",
        },
      });
      for (var l = 0; l < testFile.linkedNodeIds.length; l++) {
        elements.push({
          data: {
            id: "e-" + testFile.path + "--" + testFile.linkedNodeIds[l],
            source: testFile.path,
            target: testFile.linkedNodeIds[l],
          },
        });
      }
    }

    // Count connections per node for sizing
    var connectionCount = {};
    for (var e = 0; e < data.edges.length; e++) {
      var edge = data.edges[e];
      connectionCount[edge.callerId] = (connectionCount[edge.callerId] || 0) + 1;
      connectionCount[edge.calleeId] = (connectionCount[edge.calleeId] || 0) + 1;
    }
    for (var tf = 0; tf < data.testFiles.length; tf++) {
      for (var tl = 0; tl < data.testFiles[tf].linkedNodeIds.length; tl++) {
        var linked = data.testFiles[tf].linkedNodeIds[tl];
        connectionCount[linked] = (connectionCount[linked] || 0) + 1;
      }
    }

    // Function nodes
    for (var j = 0; j < data.nodes.length; j++) {
      var node = data.nodes[j];
      var mod2 = getModuleFromPath(node.filePath);
      var colorIdx2 = moduleColorIndex[mod2] || 0;
      var conns = connectionCount[node.id] || 0;
      var nodeSize = Math.min(48, Math.max(16, 16 + conns * 5));
      elements.push({
        data: {
          id: node.id,
          label: node.symbolName,
          fileName: node.filePath.split("/").pop(),
          filePath: node.filePath,
          type: "function",
          kind: node.kind || "function",
          exported: node.exported || false,
          module: mod2,
          moduleColorBg: MODULE_COLORS[colorIdx2].bg,
          moduleColorBorder: MODULE_COLORS[colorIdx2].border,
          impactLevel: "none",
          nodeSize: nodeSize,
        },
      });
    }

    // Call edges (hidden by default)
    for (var e2 = 0; e2 < data.edges.length; e2++) {
      var edge = data.edges[e2];
      elements.push({
        data: {
          id: "e-" + edge.callerId + "--" + edge.calleeId,
          source: edge.callerId,
          target: edge.calleeId,
        },
      });
    }

    window.__blastModules = moduleList;
    window.__blastModuleColors = moduleColorIndex;

    // Module label nodes — non-interactive, placed at cluster centers
    for (var ml = 0; ml < moduleList.length; ml++) {
      var mlMod = moduleList[ml];
      var mlColorIdx = moduleColorIndex[mlMod] || 0;
      elements.push({
        data: {
          id: "modlabel::" + mlMod,
          label: mlMod + "/",
          type: "module-label",
          module: mlMod,
          moduleColorBg: MODULE_COLORS[mlColorIdx].bg,
          moduleColorBorder: MODULE_COLORS[mlColorIdx].border,
        },
      });
    }

    return elements;
  }

  function runLayout() {
    if (!cy) { return; }

    // Group nodes by module
    var moduleGroups = {};
    cy.nodes().forEach(function (n) {
      var mod = n.data("module") || "other";
      if (!moduleGroups[mod]) { moduleGroups[mod] = []; }
      moduleGroups[mod].push(n);
    });

    var moduleNames = Object.keys(moduleGroups).sort();
    var cols = Math.ceil(Math.sqrt(moduleNames.length));

    // Calculate cluster sizes based on node count
    var clusterPositions = [];
    for (var mi = 0; mi < moduleNames.length; mi++) {
      var group = moduleGroups[moduleNames[mi]];
      var nodeSpacingCalc = 70;
      var rings = 0;
      var remaining = group.length - 1; // minus center node
      while (remaining > 0) {
        rings++;
        var ringCirc = 2 * Math.PI * rings * nodeSpacingCalc;
        remaining -= Math.floor(ringCirc / nodeSpacingCalc);
      }
      var radius = Math.max(30, rings * nodeSpacingCalc + 20);
      clusterPositions.push({ mod: moduleNames[mi], group: group, radius: radius });
    }

    // Place clusters on a grid with generous spacing
    var clusterGap = 100;
    var col, row, cx, cy2;
    var maxRadiusInRow = [];
    for (var ri = 0; ri < Math.ceil(moduleNames.length / cols); ri++) {
      var maxR = 0;
      for (var ci = 0; ci < cols; ci++) {
        var idx = ri * cols + ci;
        if (idx < clusterPositions.length && clusterPositions[idx].radius > maxR) {
          maxR = clusterPositions[idx].radius;
        }
      }
      maxRadiusInRow.push(maxR);
    }

    var yOffset = 0;
    for (var mi2 = 0; mi2 < clusterPositions.length; mi2++) {
      col = mi2 % cols;
      row = Math.floor(mi2 / cols);

      // Calculate x position based on max radius in each column
      var xOffset = 0;
      for (var prevCol = 0; prevCol < col; prevCol++) {
        // Find max radius in this column
        var colMaxR = 0;
        for (var r = 0; r < Math.ceil(moduleNames.length / cols); r++) {
          var cIdx = r * cols + prevCol;
          if (cIdx < clusterPositions.length && clusterPositions[cIdx].radius > colMaxR) {
            colMaxR = clusterPositions[cIdx].radius;
          }
        }
        xOffset += colMaxR * 2 + clusterGap;
      }

      if (col === 0) {
        if (row > 0) {
          yOffset += maxRadiusInRow[row - 1] + clusterGap;
        }
      }

      var cluster = clusterPositions[mi2];
      cx = xOffset + cluster.radius;
      cy2 = yOffset + maxRadiusInRow[row];

      // Arrange nodes in a packed circular cluster (concentric rings)
      var group = cluster.group;
      var nodeSpacing = 70;
      var placed = 0;
      var ring = 0;

      // Center node
      if (placed < group.length) {
        group[placed].position({ x: cx, y: cy2 });
        placed++;
      }

      // Concentric rings outward
      while (placed < group.length) {
        ring++;
        var ringRadius = ring * nodeSpacing;
        var circumference = 2 * Math.PI * ringRadius;
        var nodesInRing = Math.min(
          Math.floor(circumference / nodeSpacing),
          group.length - placed
        );
        nodesInRing = Math.max(nodesInRing, 1);

        for (var ri2 = 0; ri2 < nodesInRing && placed < group.length; ri2++) {
          var angle = (2 * Math.PI * ri2) / nodesInRing - Math.PI / 2;
          group[placed].position({
            x: cx + ringRadius * Math.cos(angle),
            y: cy2 + ringRadius * Math.sin(angle),
          });
          placed++;
        }
      }
    }

    cy.fit(undefined, 50);

    // Position module labels at cluster centers
    for (var ml = 0; ml < clusterPositions.length; ml++) {
      var labelNode = cy.getElementById("modlabel::" + clusterPositions[ml].mod);
      if (labelNode && labelNode.length > 0) {
        // Find the center of this cluster's nodes
        var clGroup = clusterPositions[ml].group;
        var sumX = 0, sumY = 0;
        for (var gi = 0; gi < clGroup.length; gi++) {
          var gp = clGroup[gi].position();
          sumX += gp.x;
          sumY += gp.y;
        }
        labelNode.position({ x: sumX / clGroup.length, y: sumY / clGroup.length });
      }
    }

    // Save positions for reset animation
    window.__savedPositions = {};
    cy.nodes().forEach(function (n) {
      var pos = n.position();
      window.__savedPositions[n.id()] = { x: pos.x, y: pos.y };
    });
  }

  function buildStylesheet() {
    var textColor = getTextColor();
    var outlineColor = getOutlineColor();

    return [
      // ── Module label nodes (cluster centers) ──
      {
        selector: "node[type='module-label']",
        style: {
          "background-color": "data(moduleColorBg)",
          "background-opacity": 0.12,
          "border-width": 0,
          label: "data(label)",
          "text-valign": "center",
          "text-halign": "center",
          "font-size": "22px",
          "font-weight": "800",
          color: "data(moduleColorBorder)",
          "text-outline-width": 3,
          "text-outline-color": outlineColor,
          "text-opacity": 0.9,
          width: 60,
          height: 60,
          shape: "ellipse",
          "events": "no",
        },
      },
      // ── Function nodes ──
      {
        selector: "node[type='function']",
        style: {
          "background-color": "data(moduleColorBg)",
          "border-color": "data(moduleColorBorder)",
          label: "",
          "text-valign": "bottom",
          "text-halign": "center",
          "font-size": "14px",
          "font-weight": "600",
          color: textColor,
          "text-outline-width": 2,
          "text-outline-color": outlineColor,
          "text-margin-y": 4,
          width: "data(nodeSize)",
          height: "data(nodeSize)",
          "border-width": 2,
          "transition-property": "background-color, border-color, opacity, width, height",
          "transition-duration": "0.2s",
        },
      },
      // ── Test nodes ──
      {
        selector: "node[type='test']",
        style: {
          "background-color": "#48bb78",
          "border-color": "#68d391",
          label: "",
          "text-valign": "bottom",
          "text-halign": "center",
          "font-size": "13px",
          color: textColor,
          "text-outline-width": 2,
          "text-outline-color": outlineColor,
          "text-margin-y": 4,
          shape: "diamond",
          width: 20,
          height: 20,
          "border-width": 2,
        },
      },
      // Shape by function kind
      {
        selector: "node[kind='method']",
        style: { shape: "round-rectangle" },
      },
      // Exported = solid fill (default). Internal = hollow outline.
      {
        selector: "node[type='function'][!exported]",
        style: { "background-opacity": 0.15, "border-width": 3 },
      },
      // ── Impact level overrides ──
      {
        selector: "node[impactLevel='selected']",
        style: { "background-color": "#f6e05e", "border-color": "#faf089", "border-width": 3, width: 36, height: 36, "z-index": 10, label: "data(label)" },
      },
      {
        selector: "node[impactLevel='high']",
        style: { "background-color": "#fc8181", "border-color": "#feb2b2", "border-width": 2.5, label: "data(label)" },
      },
      {
        selector: "node[impactLevel='medium']",
        style: { "background-color": "#f6ad55", "border-color": "#fbd38d", "border-width": 2, label: "data(label)" },
      },
      {
        selector: "node[impactLevel='low']",
        style: { "background-color": "#76e4f7", "border-color": "#b2f5ea", "border-width": 1.5, label: "data(label)" },
      },
      {
        selector: "node[impactLevel='test']",
        style: { "background-color": "#68d391", "border-color": "#9ae6b4", "border-width": 2, label: "data(label)" },
      },
      {
        selector: "node[impactLevel='dimmed']",
        style: { opacity: 0.15 },
      },
      // ── Edges — hidden by default, shown on blast radius click ──
      {
        selector: "edge",
        style: {
          width: 1.5,
          "line-color": "#4a5568",
          "target-arrow-color": "#4a5568",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          opacity: 0,
          "transition-property": "line-color, opacity",
          "transition-duration": "0.2s",
        },
      },
      {
        selector: "edge.highlighted",
        style: { "line-color": "#a0aec0", "target-arrow-color": "#a0aec0", opacity: 1, width: 2 },
      },
      {
        selector: "edge.callee-edge",
        style: { "line-color": "#fc8181", "target-arrow-color": "#fc8181", opacity: 1, width: 2, "z-index": 10 },
      },
      {
        selector: "edge.caller-edge",
        style: { "line-color": "#63b3ed", "target-arrow-color": "#63b3ed", opacity: 1, width: 2, "z-index": 10 },
      },
      {
        selector: "edge.dimmed",
        style: { opacity: 0.05, "z-index": 0 },
      },
      // ── Search highlight ──
      {
        selector: "node.search-match",
        style: { "border-width": 3, "border-color": "#f6e05e", "z-index": 10 },
      },
      {
        selector: "node.search-dimmed",
        style: { opacity: 0.15 },
      },
      {
        selector: "edge.search-dimmed",
        style: { opacity: 0.05 },
      },
    ];
  }

  function applyHighlight(data) {
    if (!cy) { return; }

    selectedNodeId = data.selectedNodeId;

    var downstreamArr = data.downstream || [];
    var upstreamArr = data.upstream || [];
    var linkedTests = data.linkedTests || [];

    var downstreamSet = new Set(downstreamArr);
    var upstreamSet = new Set(upstreamArr);
    var testSet = new Set(linkedTests);
    var highlightedIds = new Set([data.selectedNodeId].concat(downstreamArr).concat(upstreamArr).concat(linkedTests));

    var depthMap = bfsDepth(data.selectedNodeId, downstreamSet, upstreamSet);

    cy.nodes().forEach(function (node) {
      var id = node.id();
      // Module labels just dim
      if (node.data("type") === "module-label") {
        node.data("impactLevel", "dimmed");
        return;
      }
      if (id === data.selectedNodeId) {
        node.data("impactLevel", "selected");
      } else if (testSet.has(id)) {
        node.data("impactLevel", "test");
      } else if (highlightedIds.has(id)) {
        var d = depthMap.get(id) || 3;
        node.data("impactLevel", d === 1 ? "high" : d === 2 ? "medium" : "low");
      } else {
        node.data("impactLevel", "dimmed");
      }
    });

    cy.edges().forEach(function (edge) {
      var src = edge.source().id();
      var tgt = edge.target().id();
      if (!highlightedIds.has(src) || !highlightedIds.has(tgt)) {
        edge.removeClass("highlighted callee-edge caller-edge").addClass("dimmed");
        return;
      }
      edge.removeClass("dimmed");
      // Color by direction relative to selected node
      if (src === data.selectedNodeId || downstreamSet.has(src)) {
        edge.removeClass("caller-edge").addClass("callee-edge");
      } else {
        edge.removeClass("callee-edge").addClass("caller-edge");
      }
    });

    applyRadialLayout(data.selectedNodeId, downstreamArr, upstreamArr, linkedTests, depthMap);
    updateSidebar(data, downstreamArr, upstreamArr);
    showImpactLegend();
  }

  function bfsDepth(centerId, downstreamSet, upstreamSet) {
    var depthMap = new Map();
    if (!cy) { return depthMap; }

    var queue = [{ id: centerId, depth: 0 }];
    var visited = new Set([centerId]);
    while (queue.length > 0) {
      var item = queue.shift();
      depthMap.set(item.id, item.depth);
      var node = cy.getElementById(item.id);
      node.connectedEdges().forEach(function (edge) {
        var other = edge.source().id() === item.id ? edge.target().id() : edge.source().id();
        if (!visited.has(other) && (downstreamSet.has(other) || upstreamSet.has(other))) {
          visited.add(other);
          queue.push({ id: other, depth: item.depth + 1 });
        }
      });
    }
    return depthMap;
  }

  function applyRadialLayout(centerId, downstream, upstream, tests, depthMap) {
    if (!cy) { return; }

    var containerWidth = cy.width();
    var containerHeight = cy.height();
    var cx = containerWidth / 2;
    var cyCenter = containerHeight / 2;

    var ringRadii = [0, 130, 240, 340];
    var byDepth = [[], [], [], []];

    var allHighlighted = [centerId].concat(downstream).concat(upstream).concat(tests);
    for (var i = 0; i < allHighlighted.length; i++) {
      var id = allHighlighted[i];
      var d = Math.min(depthMap.get(id) || 0, 3);
      byDepth[d].push(id);
    }

    var positions = {};
    positions[centerId] = { x: cx, y: cyCenter };

    for (var ring = 1; ring <= 3; ring++) {
      var nodes = byDepth[ring];
      if (nodes.length === 0) { continue; }
      var r = ringRadii[ring];
      for (var j = 0; j < nodes.length; j++) {
        var angle = (2 * Math.PI * j) / nodes.length - Math.PI / 2;
        positions[nodes[j]] = { x: cx + r * Math.cos(angle), y: cyCenter + r * Math.sin(angle) };
      }
    }

    var dimmedNodes = cy.nodes().filter(function (n) {
      return n.data("impactLevel") === "dimmed";
    });
    var outerR = ringRadii[3] + 80;
    dimmedNodes.forEach(function (node, i) {
      var angle = (2 * Math.PI * i) / Math.max(dimmedNodes.length, 1);
      positions[node.id()] = { x: cx + outerR * Math.cos(angle), y: cyCenter + outerR * Math.sin(angle) };
    });

    cy.animate({ positions: positions, duration: 500, easing: "ease-in-out-cubic" });
  }

  function resetHighlight() {
    if (!cy) { return; }
    selectedNodeId = null;
    cy.nodes().forEach(function (n) {
      n.data("impactLevel", "none");
    });
    cy.edges().removeClass("highlighted callee-edge caller-edge dimmed");
    clearSidebar();
    showModuleLegend();
    if (window.__savedPositions) {
      cy.animate({ positions: window.__savedPositions, duration: 400, easing: "ease-in-out-cubic" });
    }
  }

  // ── Stats bar ──

  function populateStatsBar(data) {
    var el = document.getElementById("stats-content");
    if (!el) { return; }
    var funcs = data.nodes ? data.nodes.length : 0;
    var tests = data.testFiles ? data.testFiles.length : 0;
    var mods = data.featureModules ? data.featureModules.length : 0;
    var edges = data.edges ? data.edges.length : 0;
    el.innerHTML = '<span>' + funcs + '</span> functions · <span>' + tests + '</span> tests · <span>' + mods + '</span> modules · <span>' + edges + '</span> call edges';
  }

  // ── Legend ──

  function showModuleLegend() {
    var columns = document.querySelector(".legend-columns");
    var impactLegend = document.getElementById("impact-legend");
    if (columns) { columns.style.display = "flex"; }
    if (impactLegend) { impactLegend.style.display = "none"; }
  }

  function showImpactLegend() {
    var columns = document.querySelector(".legend-columns");
    var impactLegend = document.getElementById("impact-legend");
    if (columns) { columns.style.display = "none"; }
    if (impactLegend) { impactLegend.style.display = "flex"; }
  }

  function buildModuleLegend() {
    // Module colors are now shown via cluster labels — no need in legend
    var container = document.getElementById("module-legend");
    if (container) { container.innerHTML = ""; }

    // Shapes column
    var shapesContainer = document.getElementById("shapes-legend");
    if (shapesContainer) {
      shapesContainer.innerHTML = "";
      var shapes = [
        { label: "exported fn", html: '<div style="width:14px;height:14px;border-radius:50%;background:#888"></div>' },
        { label: "internal fn", html: '<div style="width:14px;height:14px;border-radius:50%;background:transparent;border:2px solid #888"></div>' },
        { label: "exported method", html: '<div style="width:14px;height:14px;border-radius:3px;background:#888"></div>' },
        { label: "internal method", html: '<div style="width:14px;height:14px;border-radius:3px;background:transparent;border:2px solid #888"></div>' },
        { label: "test file", html: '<div style="width:14px;height:14px;background:#68d391;clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%)"></div>' },
      ];
      for (var s = 0; s < shapes.length; s++) {
        var sItem = document.createElement("div");
        sItem.className = "legend-item";
        sItem.innerHTML = shapes[s].html + " " + shapes[s].label;
        shapesContainer.appendChild(sItem);
      }
    }

    showModuleLegend();
  }

  // ── Sidebar ──

  function updateSidebar(data, downstream, upstream) {
    if (!cy) { return; }

    document.getElementById("epicenter-label").style.display = "block";
    document.getElementById("epicenter-name").textContent = data.selectedNodeId.split("#")[1] || data.selectedNodeId;
    document.getElementById("epicenter-path").textContent = data.selectedNodeId.split("#")[0] || "";

    document.getElementById("count-impacted").textContent = data.affectedCount;
    document.getElementById("count-callers").textContent = upstream.length;
    document.getElementById("count-callees").textContent = downstream.length;

    var high = 0, medium = 0, low = 0;
    for (var i = 0; i < downstream.length; i++) {
      var level = cy.getElementById(downstream[i]).data("impactLevel");
      if (level === "high") { high++; }
      else if (level === "medium") { medium++; }
      else if (level === "low") { low++; }
    }
    var total = Math.max(high + medium + low, 1);
    document.getElementById("bar-high").style.width = ((high / total) * 100) + "%";
    document.getElementById("bar-medium").style.width = ((medium / total) * 100) + "%";
    document.getElementById("bar-low").style.width = ((low / total) * 100) + "%";
    document.getElementById("impact-counts").textContent = high + " high  " + medium + " medium  " + low + " low";

    renderNodeList("callers-list", upstream, "caller");
    renderNodeList("callees-list", downstream, "callee");

    var testList = document.getElementById("test-list");
    testList.innerHTML = "";
    var tests = data.linkedTests || [];
    for (var t = 0; t < tests.length; t++) {
      var li = document.createElement("li");
      li.className = "list-item test-item";
      li.innerHTML = '<span class="dot" style="background:#68d391"></span><span class="item-name">' + tests[t].split("/").pop() + '</span><span class="item-path">' + tests[t] + "</span>";
      testList.appendChild(li);
    }
    document.getElementById("test-coverage-count").textContent = tests.length;

    var moduleList = document.getElementById("module-list");
    moduleList.innerHTML = "";
    var modules = data.affectedModules || [];
    for (var m = 0; m < modules.length; m++) {
      var mli = document.createElement("li");
      mli.className = "list-item";
      mli.textContent = modules[m];
      moduleList.appendChild(mli);
    }

    document.getElementById("sidebar-empty").style.display = "none";
    document.getElementById("sidebar-content").style.display = "block";
    document.getElementById("sidebar").classList.add("visible");
  }

  function renderNodeList(containerId, nodeIds, role) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    if (nodeIds.length === 0) {
      container.innerHTML = '<li class="list-item muted">— none in view —</li>';
      return;
    }
    for (var i = 0; i < nodeIds.length; i++) {
      var id = nodeIds[i];
      var label = id.split("#")[1] || id;
      var filePath = id.split("#")[0] || "";
      var li = document.createElement("li");
      li.className = "list-item node-item";
      li.innerHTML = '<span class="item-name">' + label + '</span><span class="item-path">' + filePath + '</span><span class="item-role">' + (role === "caller" ? "upstream" : "downstream") + "</span>";
      (function (nodeId) {
        li.addEventListener("click", function () {
          selectedNodeId = nodeId;
          vscodeApi.postMessage({ type: "node-click", nodeId: nodeId });
        });
      })(id);
      container.appendChild(li);
    }
  }

  function clearSidebar() {
    document.getElementById("epicenter-label").style.display = "none";
    document.getElementById("sidebar-empty").style.display = "none";
    document.getElementById("sidebar-content").style.display = "none";
    document.getElementById("sidebar").classList.remove("visible");
  }

  function updateEmptyState() {
    var hasNodes = allData && allData.nodes && allData.nodes.length > 0;
    document.getElementById("empty-graph").style.display = hasNodes ? "none" : "flex";
  }

  // ── Button handlers ──

  document.getElementById("btn-reset").addEventListener("click", function () {
    resetHighlight();
  });

  document.getElementById("btn-jump").addEventListener("click", function () {
    if (selectedNodeId) {
      vscodeApi.postMessage({ type: "jump-to-source", nodeId: selectedNodeId });
    }
  });

  // Legend minimize toggle
  document.getElementById("legend-toggle").addEventListener("click", function () {
    var legend = document.getElementById("legend");
    var isMinimized = legend.classList.toggle("minimized");
    this.textContent = isMinimized ? "▸ legend" : "▾ legend";
  });

  // ── Search ──

  var activeResultIndex = -1;
  var currentResults = [];

  var CATEGORY_BADGES = {
    "function": "ƒ",
    "test": "⬡",
    "module": "▣"
  };

  var CATEGORY_ORDER = { "function": 0, "test": 1, "module": 2 };

  function renderHighlightedText(text, matches) {
    if (!matches || matches.length === 0) {
      return escapeHtml(text);
    }
    var matchSet = {};
    for (var i = 0; i < matches.length; i++) {
      matchSet[matches[i]] = true;
    }
    var html = "";
    for (var j = 0; j < text.length; j++) {
      var ch = escapeHtml(text[j]);
      if (matchSet[j]) {
        html += "<mark>" + ch + "</mark>";
      } else {
        html += ch;
      }
    }
    return html;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderSearchResults(results) {
    var resultsList = document.getElementById("search-results");
    resultsList.innerHTML = "";
    activeResultIndex = -1;
    currentResults = results;

    if (results.length === 0) {
      var noResults = document.createElement("li");
      noResults.className = "search-no-results";
      noResults.textContent = "No results found";
      resultsList.appendChild(noResults);
      resultsList.style.display = "block";
      return;
    }

    // Sort by category order, preserving score order within each category
    var grouped = results.slice().sort(function (a, b) {
      var catA = CATEGORY_ORDER[a.item.category] || 0;
      var catB = CATEGORY_ORDER[b.item.category] || 0;
      if (catA !== catB) { return catA - catB; }
      return 0; // preserve score order within category
    });

    currentResults = grouped;

    for (var i = 0; i < grouped.length; i++) {
      var result = grouped[i];
      var li = document.createElement("li");
      li.className = "search-result-item";
      li.setAttribute("data-index", i);

      var badge = document.createElement("span");
      badge.className = "search-category-badge";
      badge.textContent = CATEGORY_BADGES[result.item.category] || "";

      var primary = document.createElement("span");
      primary.className = "search-primary";
      primary.innerHTML = renderHighlightedText(result.item.label, result.labelMatches);

      li.appendChild(badge);
      li.appendChild(primary);

      if (result.item.secondaryLabel) {
        var secondary = document.createElement("span");
        secondary.className = "search-secondary";
        secondary.innerHTML = renderHighlightedText(result.item.secondaryLabel, result.secondaryMatches);
        li.appendChild(secondary);
      }

      (function (idx) {
        li.addEventListener("click", function () {
          selectSearchResult(currentResults[idx].item);
        });
      })(i);

      resultsList.appendChild(li);
    }

    resultsList.style.display = "block";
  }

  function highlightSearchMatches(results) {
    if (!cy) { return; }
    if (!results || results.length === 0) {
      clearSearchHighlight();
      return;
    }

    // Collect IDs of all matched items
    var matchedIds = {};
    for (var i = 0; i < results.length; i++) {
      var item = results[i].item;
      matchedIds[item.id] = true;
    }

    // Highlight matched nodes, dim everything else, show labels on matches
    cy.nodes().forEach(function (node) {
      var nodeType = node.data("type");
      if (nodeType === "file" || nodeType === "module-label") { return; }
      var id = node.id();
      if (matchedIds[id]) {
        node.addClass("search-match");
        node.removeClass("search-dimmed");
        node.style("label", node.data("label"));
      } else {
        node.addClass("search-dimmed");
        node.removeClass("search-match");
        node.style("label", "");
      }
    });

    cy.edges().forEach(function (edge) {
      var src = edge.source().id();
      var tgt = edge.target().id();
      if (matchedIds[src] || matchedIds[tgt]) {
        edge.removeClass("search-dimmed");
      } else {
        edge.addClass("search-dimmed");
      }
    });
  }

  function clearSearchHighlight() {
    if (!cy) { return; }
    cy.nodes().removeClass("search-match search-dimmed");
    cy.edges().removeClass("search-dimmed");
    // Hide labels again on function/test nodes
    cy.nodes("[type='function'], [type='test']").forEach(function (node) {
      var impact = node.data("impactLevel");
      if (!impact || impact === "none" || impact === "dimmed") {
        node.style("label", "");
      }
    });
  }

  document.getElementById("search-input").addEventListener("input", function () {
    var query = this.value;
    var resultsList = document.getElementById("search-results");

    if (!query || !query.trim()) {
      resultsList.style.display = "none";
      resultsList.innerHTML = "";
      currentResults = [];
      activeResultIndex = -1;
      clearSearchHighlight();
      return;
    }

    if (!searchIndex) {
      resultsList.style.display = "none";
      return;
    }

    var results = SearchEngine.fuzzySearch(query, searchIndex);
    renderSearchResults(results);
    highlightSearchMatches(results);
  });

  // ── Keyboard navigation ──

  function updateActiveResult(newIndex) {
    var items = document.querySelectorAll(".search-result-item");
    if (items.length === 0) { return; }

    // Remove current active
    if (activeResultIndex >= 0 && activeResultIndex < items.length) {
      items[activeResultIndex].classList.remove("active");
    }

    activeResultIndex = newIndex;

    if (activeResultIndex >= 0 && activeResultIndex < items.length) {
      items[activeResultIndex].classList.add("active");
      items[activeResultIndex].scrollIntoView({ block: "nearest" });
    }
  }

  document.addEventListener("keydown", function (e) {
    var searchInput = document.getElementById("search-input");

    // `/` key: focus search input when not already focused and not typing in another input
    if (e.key === "/" && document.activeElement !== searchInput &&
        document.activeElement.tagName !== "INPUT" &&
        document.activeElement.tagName !== "TEXTAREA") {
      e.preventDefault();
      expandSearch();
      searchInput.focus();
      return;
    }

    // `Escape` key: clear and blur search input
    if (e.key === "Escape" && document.activeElement === searchInput) {
      searchInput.value = "";
      document.getElementById("search-results").style.display = "none";
      currentResults = [];
      activeResultIndex = -1;
      clearSearchHighlight();
      searchInput.blur();
      searchContainer.classList.remove("expanded");
      return;
    }
  });

  document.getElementById("search-input").addEventListener("keydown", function (e) {
    var resultsList = document.getElementById("search-results");
    if (resultsList.style.display === "none") { return; }

    var items = document.querySelectorAll(".search-result-item");
    if (items.length === 0) { return; }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      var nextIndex = activeResultIndex + 1;
      if (nextIndex >= items.length) { nextIndex = 0; }
      updateActiveResult(nextIndex);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      var prevIndex = activeResultIndex - 1;
      if (prevIndex < 0) { prevIndex = items.length - 1; }
      updateActiveResult(prevIndex);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      var selectIdx = activeResultIndex >= 0 ? activeResultIndex : 0;
      if (currentResults[selectIdx]) {
        selectSearchResult(currentResults[selectIdx].item);
      }
      return;
    }
  });

  // ── Event isolation ──

  var searchContainer = document.getElementById("search-container");

  // ── Search expand/collapse ──

  function expandSearch() {
    searchContainer.classList.add("expanded");
  }

  function collapseSearch() {
    var searchInput = document.getElementById("search-input");
    if (!searchInput.value) {
      searchContainer.classList.remove("expanded");
    }
  }

  document.getElementById("search-input").addEventListener("focus", function () {
    expandSearch();
  });

  document.getElementById("search-input").addEventListener("blur", function () {
    // Delay collapse to allow click on results
    setTimeout(function () {
      collapseSearch();
    }, 200);
  });

  // Clicking the collapsed container (icon area) expands and focuses
  searchContainer.addEventListener("click", function (e) {
    e.stopPropagation();
    var searchInput = document.getElementById("search-input");
    if (!searchContainer.classList.contains("expanded")) {
      expandSearch();
      searchInput.focus();
    }
  });

  searchContainer.addEventListener("mousedown", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("click", function (e) {
    if (!searchContainer.contains(e.target)) {
      document.getElementById("search-results").style.display = "none";
      activeResultIndex = -1;
    }
  });

  // ── Result selection and graph navigation ──

  function selectSearchResult(item) {
    if (!cy || !item) { return; }

    if (item.category === "function") {
      var node = cy.getElementById(item.id);
      if (node && node.length > 0) {
        cy.center(node);
        cy.zoom({ level: 1.2, position: node.position() });
        vscodeApi.postMessage({ type: "node-click", nodeId: item.id });
      }
    } else if (item.category === "test") {
      var testNode = cy.getElementById(item.id);
      if (testNode && testNode.length > 0) {
        cy.center(testNode);
        cy.zoom({ level: 1.2, position: testNode.position() });
      }
    } else if (item.category === "module") {
      var moduleNodes = cy.nodes().filter(function (n) {
        return n.data("module") === item.id;
      });
      if (moduleNodes.length > 0) {
        cy.fit(moduleNodes, 60);
      }
    }

    // Clear search UI after selection
    var searchInput = document.getElementById("search-input");
    searchInput.value = "";
    document.getElementById("search-results").style.display = "none";
    currentResults = [];
    activeResultIndex = -1;
    clearSearchHighlight();
    searchInput.blur();
    searchContainer.classList.remove("expanded");
  }

})();
