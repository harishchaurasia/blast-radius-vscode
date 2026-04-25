// Large mock dataset (~220 nodes, ~300 edges) for performance testing.
// Simulates a mid-size TypeScript project with 12 modules.

(function () {
  var modules = [
    { name: "auth",       files: ["login", "session", "token", "oauth", "permissions"] },
    { name: "api",        files: ["client", "middleware", "interceptors", "cache"] },
    { name: "store",      files: ["userStore", "cartStore", "productStore", "orderStore"] },
    { name: "components", files: ["LoginForm", "Dashboard", "OrderList", "CartView", "Header", "Footer", "Sidebar", "Modal", "Toast"] },
    { name: "hooks",      files: ["useAuth", "useCart", "useProducts", "useOrders", "useNotifications"] },
    { name: "routes",     files: ["appRouter", "authRoutes", "apiRoutes", "adminRoutes"] },
    { name: "utils",      files: ["logger", "format", "validation", "crypto", "dates"] },
    { name: "services",   files: ["emailService", "paymentService", "notificationService", "analyticsService"] },
    { name: "models",     files: ["userModel", "orderModel", "productModel", "cartModel"] },
    { name: "config",     files: ["appConfig", "dbConfig", "cacheConfig"] },
    { name: "middleware",  files: ["errorHandler", "rateLimiter", "cors", "compression"] },
    { name: "telemetry",  files: ["tracker", "metrics", "spans"] },
  ];

  var nodes = [];
  var edges = [];
  var allNodeIds = [];

  // Generate 2-4 functions per file
  var funcNames = [
    "init", "handle", "process", "validate", "create", "update", "delete",
    "fetch", "get", "set", "transform", "parse", "render", "compute",
    "check", "verify", "build", "resolve", "dispatch", "emit",
    "load", "save", "reset", "configure", "register", "subscribe",
  ];

  var nodeIndex = 0;
  var fileNodeMap = {}; // filePath -> [nodeIds]

  for (var m = 0; m < modules.length; m++) {
    var mod = modules[m];
    for (var f = 0; f < mod.files.length; f++) {
      var fileName = mod.files[f];
      var filePath = "src/" + mod.name + "/" + fileName + ".ts";
      var funcsInFile = 2 + (nodeIndex % 3); // 2-4 functions per file
      fileNodeMap[filePath] = [];

      for (var fn = 0; fn < funcsInFile; fn++) {
        var funcName = funcNames[(nodeIndex + fn) % funcNames.length] + fileName.charAt(0).toUpperCase() + fileName.slice(1);
        if (fn > 0) { funcName = funcNames[(nodeIndex + fn + 7) % funcNames.length] + fileName.charAt(0).toUpperCase() + fileName.slice(1); }
        var nodeId = filePath + "#" + funcName;
        var kinds = ["function", "arrow", "method"];

        nodes.push({
          id: nodeId,
          filePath: filePath,
          symbolName: funcName,
          startLine: 1 + fn * 20,
          endLine: 18 + fn * 20,
          kind: kinds[fn % 3],
        });

        allNodeIds.push(nodeId);
        fileNodeMap[filePath].push(nodeId);
        nodeIndex++;
      }
    }
  }

  // Generate edges: intra-file calls + cross-file calls
  // Seed-based pseudo-random for reproducibility
  var seed = 42;
  function rand() { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; }

  // Intra-file: each function calls the next one in the same file
  for (var fp in fileNodeMap) {
    var group = fileNodeMap[fp];
    for (var g = 0; g < group.length - 1; g++) {
      edges.push({ callerId: group[g], calleeId: group[g + 1] });
    }
  }

  // Cross-file: ~200 random edges between different files
  for (var e = 0; e < 200; e++) {
    var srcIdx = Math.floor(rand() * allNodeIds.length);
    var tgtIdx = Math.floor(rand() * allNodeIds.length);
    if (srcIdx !== tgtIdx) {
      var srcId = allNodeIds[srcIdx];
      var tgtId = allNodeIds[tgtIdx];
      // Avoid duplicate edges
      edges.push({ callerId: srcId, calleeId: tgtId });
    }
  }

  // Generate test files — one per module
  var testFiles = [];
  for (var t = 0; t < modules.length; t++) {
    var tmod = modules[t];
    var testPath = "src/" + tmod.name + "/__tests__/" + tmod.name + ".test.ts";
    // Link to first 3 functions in the module
    var linked = [];
    for (var tf = 0; tf < tmod.files.length && linked.length < 4; tf++) {
      var tfp = "src/" + tmod.name + "/" + tmod.files[tf] + ".ts";
      if (fileNodeMap[tfp] && fileNodeMap[tfp].length > 0) {
        linked.push(fileNodeMap[tfp][0]);
      }
    }
    testFiles.push({ path: testPath, linkedNodeIds: linked });
  }

  // Collect feature modules
  var featureModules = [];
  for (var fm = 0; fm < modules.length; fm++) {
    featureModules.push(modules[fm].name);
  }

  window.MOCK_GRAPH_DATA_LARGE = {
    type: "graph-data",
    nodes: nodes,
    edges: edges,
    testFiles: testFiles,
    featureModules: featureModules,
  };

  // Summary
  console.log("[mockDataLarge] Generated " + nodes.length + " nodes, " + edges.length + " edges, " + testFiles.length + " test files");
})();
