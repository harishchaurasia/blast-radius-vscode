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

  // In VS Code, data arrives via postMessage. In dev mode, we load mock data on init.
  window.addEventListener("message", function (event) {
    var message = event.data;
    if (message.type === "graph-data") {
      allData = message;
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
      // Ignore clicks on file box parents
      if (nodeType === "file") { return; }
      const nodeId = node.id();
      selectedNodeId = nodeId;
      vscodeApi.postMessage({ type: "node-click", nodeId: nodeId });    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        resetHighlight();
      }
    });

    runLayout();
    buildModuleLegend();
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

    // Create parent (file box) nodes — one per unique filePath
    var seenFiles = {};
    for (var i = 0; i < data.nodes.length; i++) {
      var fp = data.nodes[i].filePath;
      if (!seenFiles[fp]) {
        seenFiles[fp] = true;
        var mod = getModuleFromPath(fp);
        var colorIdx = moduleColorIndex[mod] || 0;
        var fileName = fp.split("/").pop();
        elements.push({
          data: {
            id: "file::" + fp,
            label: fileName,
            filePath: fp,
            type: "file",
            module: mod,
            moduleColorBg: MODULE_COLORS[colorIdx].bg,
            moduleColorBorder: MODULE_COLORS[colorIdx].border,
          },
        });
      }
    }

    // Create test file nodes — no parent box, they float freely
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

    // Create function child nodes — parented to their file box
    for (var j = 0; j < data.nodes.length; j++) {
      var node = data.nodes[j];
      var mod2 = getModuleFromPath(node.filePath);
      var colorIdx2 = moduleColorIndex[mod2] || 0;
      elements.push({
        data: {
          id: node.id,
          label: node.symbolName,
          filePath: node.filePath,
          parent: "file::" + node.filePath,
          type: "function",
          module: mod2,
          moduleColorBg: MODULE_COLORS[colorIdx2].bg,
          moduleColorBorder: MODULE_COLORS[colorIdx2].border,
          impactLevel: "none",
        },
      });
    }

    // Edges between function nodes
    for (var e = 0; e < data.edges.length; e++) {
      var edge = data.edges[e];
      elements.push({
        data: {
          id: "e-" + edge.callerId + "--" + edge.calleeId,
          source: edge.callerId,
          target: edge.calleeId,
        },
      });
    }

    // Store module list for legend
    window.__blastModules = moduleList;
    window.__blastModuleColors = moduleColorIndex;

    return elements;
  }

  function runLayout() {
    if (!cy) { return; }

    var orphans = cy.nodes(":orphan");
    var count = orphans.length;
    if (count === 0) { return; }

    // Scatter top-level nodes randomly across a wide canvas
    var canvasW = Math.max(900, count * 28);
    var canvasH = Math.max(650, count * 20);
    // Use a seeded-ish shuffle so same data gives same layout on reload,
    // but still looks organic. Simple approach: place in a jittered grid.
    var cols = Math.ceil(Math.sqrt(count * 1.5));
    var cellW = canvasW / cols;
    var cellH = canvasH / Math.ceil(count / cols);

    // Shuffle the order so same-module files aren't always adjacent
    var indices = [];
    for (var s = 0; s < count; s++) { indices.push(s); }
    // Fisher-Yates with a fixed seed based on node ids for stability
    var seed = 0;
    orphans.forEach(function(n) {
      for (var c = 0; c < n.id().length; c++) { seed += n.id().charCodeAt(c); }
    });
    function rand() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return Math.abs(seed) / 0x7fffffff; }
    for (var i = indices.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
    }

    orphans.forEach(function (node, idx) {
      var slot = indices[idx];
      var col = slot % cols;
      var row = Math.floor(slot / cols);
      // Small fixed offsets based on slot to break the grid feel without overlapping
      var offsetX = (slot % 3 - 1) * 20;
      var offsetY = (Math.floor(slot / 3) % 3 - 1) * 15;
      node.position({
        x: cellW * col + cellW / 2 + offsetX,
        y: cellH * row + cellH / 2 + offsetY,
      });
    });

    // Position children inside each file box
    cy.nodes("[type='file']").forEach(function (fileNode) {
      var children = fileNode.children();
      var childCount = children.length;
      if (childCount === 0) { return; }

      var pos = fileNode.position();
      var childCols = Math.ceil(Math.sqrt(childCount));
      var spacingX = 48;
      var spacingY = 44;
      var totalW = (childCols - 1) * spacingX;
      var totalH = (Math.ceil(childCount / childCols) - 1) * spacingY;

      children.forEach(function (child, ci) {
        var cc = ci % childCols;
        var cr = Math.floor(ci / childCols);
        child.position({
          x: pos.x - totalW / 2 + cc * spacingX,
          y: pos.y - totalH / 2 + cr * spacingY + 8,
        });
      });
    });

    cy.fit(undefined, 60);
  }

  function buildStylesheet() {
    var textColor = getTextColor();
    var outlineColor = getOutlineColor();

    return [
      // ── File box (parent/compound node) ──
      {
        selector: "node[type='file']",
        style: {
          "background-color": "data(moduleColorBg)",
          "background-opacity": 0.12,
          "border-color": "data(moduleColorBorder)",
          "border-width": 2,
          "border-opacity": 0.7,
          label: "data(label)",
          "text-valign": "top",
          "text-halign": "center",
          "font-size": "11px",
          "font-weight": "600",
          color: textColor,
          "text-outline-width": 0,
          "text-margin-y": -6,
          "padding": "14px",
          shape: "roundrectangle",
        },
      },
      // ── Test nodes (floating, no parent box) ──
      {
        selector: "node[type='test']",
        style: {
          "background-color": "#48bb78",
          "border-color": "#68d391",
          label: "data(label)",
          "text-valign": "bottom",
          "text-halign": "center",
          "font-size": "10px",
          color: textColor,
          "text-outline-width": 2,
          "text-outline-color": outlineColor,
          "text-margin-y": 4,
          shape: "diamond",
          width: 22,
          height: 22,
          "border-width": 2,
        },
      },
      {
        selector: "node[type='function']",
        style: {
          "background-color": "data(moduleColorBg)",
          "border-color": "data(moduleColorBorder)",
          label: "data(label)",
          "text-valign": "bottom",
          "text-halign": "center",
          "font-size": "10px",
          color: textColor,
          "text-outline-width": 2,
          "text-outline-color": outlineColor,
          "text-margin-y": 4,
          width: 26,
          height: 26,
          "border-width": 2,
          "transition-property": "background-color, border-color, opacity, width, height",
          "transition-duration": "0.2s",
        },
      },
      // ── Impact level overrides ──
      {
        selector: "node[impactLevel='selected']",
        style: { "background-color": "#f6e05e", "border-color": "#faf089", "border-width": 3, width: 36, height: 36, "z-index": 10 },
      },
      {
        selector: "node[impactLevel='high']",
        style: { "background-color": "#fc8181", "border-color": "#feb2b2", "border-width": 2.5 },
      },
      {
        selector: "node[impactLevel='medium']",
        style: { "background-color": "#f6ad55", "border-color": "#fbd38d", "border-width": 2 },
      },
      {
        selector: "node[impactLevel='low']",
        style: { "background-color": "#76e4f7", "border-color": "#b2f5ea", "border-width": 1.5 },
      },
      {
        selector: "node[impactLevel='test']",
        style: { "background-color": "#68d391", "border-color": "#9ae6b4", "border-width": 2 },
      },
      {
        selector: "node[impactLevel='dimmed']",
        style: { opacity: 0.15 },
      },
      // ── Edges ──
      {
        selector: "edge",
        style: {
          width: 1.5,
          "line-color": "#4a5568",
          "target-arrow-color": "#4a5568",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          opacity: 0.6,
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
        style: { "line-color": "#fc8181", "target-arrow-color": "#fc8181", opacity: 1, width: 2 },
      },
      {
        selector: "edge.caller-edge",
        style: { "line-color": "#63b3ed", "target-arrow-color": "#63b3ed", opacity: 1, width: 2 },
      },
      {
        selector: "edge.dimmed",
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
      // Skip parent file boxes — they inherit opacity from children
      if (node.data("type") === "file" || node.data("type") === "file-test") { return; }
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
      return n.data("impactLevel") === "dimmed" && n.data("type") !== "file" && n.data("type") !== "file-test";
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
      if (n.data("type") !== "file" && n.data("type") !== "file-test") {
        n.data("impactLevel", "none");
      }
    });
    cy.edges().removeClass("highlighted dimmed callee-edge caller-edge");
    clearSidebar();
    showModuleLegend();
  }

  // ── Legend ──

  function showModuleLegend() {
    var container = document.getElementById("module-legend");
    var impactLegend = document.getElementById("impact-legend");
    if (container) { container.style.display = "flex"; }
    if (impactLegend) { impactLegend.style.display = "none"; }
  }

  function showImpactLegend() {
    var container = document.getElementById("module-legend");
    var impactLegend = document.getElementById("impact-legend");
    if (container) { container.style.display = "none"; }
    if (impactLegend) { impactLegend.style.display = "flex"; }
  }

  function buildModuleLegend() {
    var COLORS = [
      "#4299e1", "#ed8936", "#9f7aea", "#e53e3e", "#38b2ac",
      "#d69e2e", "#dd6b20", "#3182ce", "#805ad5", "#e53e3e",
    ];
    var container = document.getElementById("module-legend");
    if (!container || !window.__blastModules) { return; }
    container.innerHTML = "";
    for (var i = 0; i < window.__blastModules.length; i++) {
      var mod = window.__blastModules[i];
      var idx = window.__blastModuleColors[mod] || 0;
      var item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = '<div class="legend-dot" style="background:' + COLORS[idx] + ';opacity:0.5;border:2px solid ' + COLORS[idx] + '"></div> ' + mod + '/';
      container.appendChild(item);
    }
    // Add test dot
    var testItem = document.createElement("div");
    testItem.className = "legend-item";
    testItem.innerHTML = '<div class="legend-dot dot-green"></div> test files';
    container.appendChild(testItem);
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
      li.innerHTML = '<span class="item-name">' + label + '</span><span class="item-path">' + filePath + '</span><span class="item-role">' + (role === "caller" ? "calls this" : "called by") + "</span>";
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
    document.getElementById("sidebar-empty").style.display = "block";
    document.getElementById("sidebar-content").style.display = "none";
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

})();
