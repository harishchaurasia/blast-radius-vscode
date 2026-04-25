// Mock data that matches the GraphDataMessage and HighlightMessage interfaces.
// Edit this to test different graph shapes, sizes, and edge cases.

var MOCK_GRAPH_DATA = {
  type: "graph-data",

  nodes: [
    // ── Auth module ──
    { id: "src/auth/login.ts#handleLogin",       filePath: "src/auth/login.ts",       symbolName: "handleLogin",       startLine: 5,  endLine: 20, kind: "function", exported: true },
    { id: "src/auth/login.ts#validateCredentials",filePath: "src/auth/login.ts",       symbolName: "validateCredentials",startLine: 22, endLine: 35, kind: "function" },
    { id: "src/auth/session.ts#createSession",    filePath: "src/auth/session.ts",     symbolName: "createSession",     startLine: 3,  endLine: 18, kind: "function", exported: true },
    { id: "src/auth/session.ts#refreshSession",   filePath: "src/auth/session.ts",     symbolName: "refreshSession",    startLine: 20, endLine: 40, kind: "function", exported: true },
    { id: "src/auth/token.ts#generateToken",      filePath: "src/auth/token.ts",       symbolName: "generateToken",     startLine: 1,  endLine: 12, kind: "arrow", exported: true },
    { id: "src/auth/token.ts#verifyToken",        filePath: "src/auth/token.ts",       symbolName: "verifyToken",       startLine: 14, endLine: 28, kind: "arrow", exported: true },

    // ── API module ──
    { id: "src/api/client.ts#fetchUser",          filePath: "src/api/client.ts",       symbolName: "fetchUser",         startLine: 10, endLine: 25, kind: "function", exported: true },
    { id: "src/api/client.ts#fetchOrders",        filePath: "src/api/client.ts",       symbolName: "fetchOrders",       startLine: 27, endLine: 45, kind: "function", exported: true },
    { id: "src/api/client.ts#postOrder",          filePath: "src/api/client.ts",       symbolName: "postOrder",         startLine: 47, endLine: 60, kind: "function", exported: true },
    { id: "src/api/middleware.ts#withAuth",        filePath: "src/api/middleware.ts",   symbolName: "withAuth",          startLine: 1,  endLine: 15, kind: "arrow", exported: true },

    // ── Store module ──
    { id: "src/store/userStore.ts#setUser",       filePath: "src/store/userStore.ts",  symbolName: "setUser",           startLine: 5,  endLine: 12, kind: "function", exported: true },
    { id: "src/store/userStore.ts#getUser",       filePath: "src/store/userStore.ts",  symbolName: "getUser",           startLine: 14, endLine: 20, kind: "function", exported: true },
    { id: "src/store/cartStore.ts#addToCart",     filePath: "src/store/cartStore.ts",  symbolName: "addToCart",         startLine: 3,  endLine: 18, kind: "function", exported: true },
    { id: "src/store/cartStore.ts#calculateTotal",filePath: "src/store/cartStore.ts",  symbolName: "calculateTotal",    startLine: 20, endLine: 35, kind: "function" },

    // ── Components module ──
    { id: "src/components/LoginForm.ts#onSubmit",       filePath: "src/components/LoginForm.ts",  symbolName: "onSubmit",       startLine: 15, endLine: 30, kind: "method" },
    { id: "src/components/Dashboard.ts#loadDashboard",  filePath: "src/components/Dashboard.ts",  symbolName: "loadDashboard",  startLine: 8,  endLine: 40, kind: "method" },
    { id: "src/components/OrderList.ts#renderOrders",   filePath: "src/components/OrderList.ts",  symbolName: "renderOrders",   startLine: 5,  endLine: 25, kind: "method" },
    { id: "src/components/CartView.ts#checkout",        filePath: "src/components/CartView.ts",   symbolName: "checkout",       startLine: 10, endLine: 35, kind: "method" },

    // ── Utils ──
    { id: "src/utils/logger.ts#log",              filePath: "src/utils/logger.ts",     symbolName: "log",               startLine: 1,  endLine: 8,  kind: "arrow", exported: true },
    { id: "src/utils/format.ts#formatCurrency",   filePath: "src/utils/format.ts",     symbolName: "formatCurrency",    startLine: 1,  endLine: 10, kind: "arrow" },
  ],

  edges: [
    // LoginForm -> auth
    { callerId: "src/components/LoginForm.ts#onSubmit",       calleeId: "src/auth/login.ts#handleLogin" },
    // handleLogin -> validateCredentials -> createSession -> generateToken
    { callerId: "src/auth/login.ts#handleLogin",              calleeId: "src/auth/login.ts#validateCredentials" },
    { callerId: "src/auth/login.ts#handleLogin",              calleeId: "src/auth/session.ts#createSession" },
    { callerId: "src/auth/session.ts#createSession",          calleeId: "src/auth/token.ts#generateToken" },
    { callerId: "src/auth/session.ts#refreshSession",         calleeId: "src/auth/token.ts#verifyToken" },
    { callerId: "src/auth/session.ts#refreshSession",         calleeId: "src/auth/token.ts#generateToken" },
    // Dashboard -> fetchUser -> withAuth, setUser
    { callerId: "src/components/Dashboard.ts#loadDashboard",  calleeId: "src/api/client.ts#fetchUser" },
    { callerId: "src/components/Dashboard.ts#loadDashboard",  calleeId: "src/api/client.ts#fetchOrders" },
    { callerId: "src/api/client.ts#fetchUser",                calleeId: "src/api/middleware.ts#withAuth" },
    { callerId: "src/api/client.ts#fetchUser",                calleeId: "src/store/userStore.ts#setUser" },
    { callerId: "src/api/client.ts#fetchOrders",              calleeId: "src/api/middleware.ts#withAuth" },
    // withAuth -> verifyToken
    { callerId: "src/api/middleware.ts#withAuth",              calleeId: "src/auth/token.ts#verifyToken" },
    // OrderList -> fetchOrders
    { callerId: "src/components/OrderList.ts#renderOrders",   calleeId: "src/api/client.ts#fetchOrders" },
    // CartView -> checkout -> postOrder, calculateTotal, formatCurrency
    { callerId: "src/components/CartView.ts#checkout",        calleeId: "src/api/client.ts#postOrder" },
    { callerId: "src/components/CartView.ts#checkout",        calleeId: "src/store/cartStore.ts#calculateTotal" },
    { callerId: "src/store/cartStore.ts#calculateTotal",      calleeId: "src/utils/format.ts#formatCurrency" },
    { callerId: "src/api/client.ts#postOrder",                calleeId: "src/api/middleware.ts#withAuth" },
    // Logging
    { callerId: "src/auth/login.ts#handleLogin",              calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/api/client.ts#postOrder",                calleeId: "src/utils/logger.ts#log" },
  ],

  testFiles: [
    { path: "src/auth/__tests__/login.test.ts",    linkedNodeIds: ["src/auth/login.ts#handleLogin", "src/auth/login.ts#validateCredentials", "src/auth/session.ts#createSession"] },
    { path: "src/auth/__tests__/session.test.ts",   linkedNodeIds: ["src/auth/session.ts#createSession", "src/auth/session.ts#refreshSession", "src/auth/token.ts#generateToken"] },
    { path: "src/api/__tests__/client.test.ts",     linkedNodeIds: ["src/api/client.ts#fetchUser", "src/api/client.ts#fetchOrders", "src/api/client.ts#postOrder"] },
    { path: "src/store/__tests__/cartStore.test.ts", linkedNodeIds: ["src/store/cartStore.ts#addToCart", "src/store/cartStore.ts#calculateTotal"] },
  ],

  featureModules: ["auth", "api", "store", "components", "utils"],
};

// Pre-built highlight responses for specific nodes so you can test
// the sidebar + radial layout without a real backend.
var MOCK_HIGHLIGHTS = {
  "src/auth/session.ts#createSession": {
    type: "highlight",
    selectedNodeId: "src/auth/session.ts#createSession",
    downstream: ["src/auth/token.ts#generateToken"],
    upstream: ["src/auth/login.ts#handleLogin", "src/components/LoginForm.ts#onSubmit"],
    linkedTests: ["src/auth/__tests__/login.test.ts", "src/auth/__tests__/session.test.ts"],
    affectedModules: ["auth", "components"],
    affectedCount: 3,
  },
  "src/api/middleware.ts#withAuth": {
    type: "highlight",
    selectedNodeId: "src/api/middleware.ts#withAuth",
    downstream: ["src/auth/token.ts#verifyToken"],
    upstream: [
      "src/api/client.ts#fetchUser",
      "src/api/client.ts#fetchOrders",
      "src/api/client.ts#postOrder",
      "src/components/Dashboard.ts#loadDashboard",
      "src/components/OrderList.ts#renderOrders",
      "src/components/CartView.ts#checkout",
    ],
    linkedTests: ["src/api/__tests__/client.test.ts"],
    affectedModules: ["api", "auth", "components"],
    affectedCount: 7,
  },
  "src/components/CartView.ts#checkout": {
    type: "highlight",
    selectedNodeId: "src/components/CartView.ts#checkout",
    downstream: [
      "src/api/client.ts#postOrder",
      "src/store/cartStore.ts#calculateTotal",
      "src/api/middleware.ts#withAuth",
      "src/auth/token.ts#verifyToken",
      "src/utils/format.ts#formatCurrency",
      "src/utils/logger.ts#log",
    ],
    upstream: [],
    linkedTests: ["src/api/__tests__/client.test.ts", "src/store/__tests__/cartStore.test.ts"],
    affectedModules: ["api", "store", "auth", "utils", "components"],
    affectedCount: 6,
  },
};
