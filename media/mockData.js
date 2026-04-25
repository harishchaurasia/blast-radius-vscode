// Mock data for the Blast Radius webview dev mode.
// Simulates a mid-size e-commerce TypeScript monorepo with 6 modules,
// ~35 functions (mix of exported public APIs and internal helpers),
// realistic call chains, and 8 test files.

var MOCK_GRAPH_DATA = {
  type: "graph-data",

  nodes: [
    // ── auth module ──────────────────────────────────────────────
    { id: "src/auth/login.ts#handleLogin",            filePath: "src/auth/login.ts",         symbolName: "handleLogin",            startLine: 12, endLine: 28, kind: "function", exported: true },
    { id: "src/auth/login.ts#validateCredentials",    filePath: "src/auth/login.ts",         symbolName: "validateCredentials",    startLine: 4,  endLine: 10, kind: "function", exported: false },
    { id: "src/auth/session.ts#createSession",        filePath: "src/auth/session.ts",       symbolName: "createSession",          startLine: 3,  endLine: 14, kind: "function", exported: true },
    { id: "src/auth/session.ts#refreshSession",       filePath: "src/auth/session.ts",       symbolName: "refreshSession",         startLine: 16, endLine: 30, kind: "function", exported: true },
    { id: "src/auth/session.ts#destroySession",       filePath: "src/auth/session.ts",       symbolName: "destroySession",         startLine: 32, endLine: 38, kind: "function", exported: true },
    { id: "src/auth/token.ts#generateToken",          filePath: "src/auth/token.ts",         symbolName: "generateToken",          startLine: 1,  endLine: 8,  kind: "arrow",    exported: true },
    { id: "src/auth/token.ts#verifyToken",            filePath: "src/auth/token.ts",         symbolName: "verifyToken",            startLine: 10, endLine: 22, kind: "arrow",    exported: true },
    { id: "src/auth/token.ts#decodePayload",          filePath: "src/auth/token.ts",         symbolName: "decodePayload",          startLine: 24, endLine: 32, kind: "arrow",    exported: false },

    // ── api module ───────────────────────────────────────────────
    { id: "src/api/client.ts#fetchUser",              filePath: "src/api/client.ts",         symbolName: "fetchUser",              startLine: 10, endLine: 22, kind: "function", exported: true },
    { id: "src/api/client.ts#fetchOrders",            filePath: "src/api/client.ts",         symbolName: "fetchOrders",            startLine: 24, endLine: 40, kind: "function", exported: true },
    { id: "src/api/client.ts#postOrder",              filePath: "src/api/client.ts",         symbolName: "postOrder",              startLine: 42, endLine: 58, kind: "function", exported: true },
    { id: "src/api/client.ts#deleteOrder",            filePath: "src/api/client.ts",         symbolName: "deleteOrder",            startLine: 60, endLine: 72, kind: "function", exported: true },
    { id: "src/api/middleware.ts#withAuth",            filePath: "src/api/middleware.ts",     symbolName: "withAuth",               startLine: 1,  endLine: 12, kind: "arrow",    exported: true },
    { id: "src/api/middleware.ts#rateLimiter",         filePath: "src/api/middleware.ts",     symbolName: "rateLimiter",            startLine: 14, endLine: 28, kind: "arrow",    exported: false },
    { id: "src/api/middleware.ts#buildHeaders",        filePath: "src/api/middleware.ts",     symbolName: "buildHeaders",           startLine: 30, endLine: 40, kind: "arrow",    exported: false },

    // ── cart module ──────────────────────────────────────────────
    { id: "src/cart/cartStore.ts#addToCart",           filePath: "src/cart/cartStore.ts",     symbolName: "addToCart",              startLine: 8,  endLine: 22, kind: "function", exported: true },
    { id: "src/cart/cartStore.ts#removeFromCart",      filePath: "src/cart/cartStore.ts",     symbolName: "removeFromCart",         startLine: 24, endLine: 36, kind: "function", exported: true },
    { id: "src/cart/cartStore.ts#getCartItems",        filePath: "src/cart/cartStore.ts",     symbolName: "getCartItems",           startLine: 38, endLine: 44, kind: "function", exported: true },
    { id: "src/cart/pricing.ts#calculateSubtotal",     filePath: "src/cart/pricing.ts",       symbolName: "calculateSubtotal",      startLine: 3,  endLine: 12, kind: "function", exported: true },
    { id: "src/cart/pricing.ts#applyDiscount",         filePath: "src/cart/pricing.ts",       symbolName: "applyDiscount",          startLine: 14, endLine: 26, kind: "function", exported: true },
    { id: "src/cart/pricing.ts#calculateTax",          filePath: "src/cart/pricing.ts",       symbolName: "calculateTax",           startLine: 28, endLine: 36, kind: "function", exported: false },
    { id: "src/cart/pricing.ts#calculateTotal",        filePath: "src/cart/pricing.ts",       symbolName: "calculateTotal",         startLine: 38, endLine: 52, kind: "function", exported: true },

    // ── checkout module ──────────────────────────────────────────
    { id: "src/checkout/checkout.ts#startCheckout",    filePath: "src/checkout/checkout.ts",  symbolName: "startCheckout",          startLine: 5,  endLine: 30, kind: "function", exported: true },
    { id: "src/checkout/checkout.ts#validateCart",      filePath: "src/checkout/checkout.ts",  symbolName: "validateCart",            startLine: 32, endLine: 48, kind: "function", exported: false },
    { id: "src/checkout/payment.ts#processPayment",    filePath: "src/checkout/payment.ts",   symbolName: "processPayment",         startLine: 3,  endLine: 24, kind: "function", exported: true },
    { id: "src/checkout/payment.ts#validateCard",      filePath: "src/checkout/payment.ts",   symbolName: "validateCard",           startLine: 26, endLine: 40, kind: "function", exported: false },
    { id: "src/checkout/payment.ts#chargeCard",        filePath: "src/checkout/payment.ts",   symbolName: "chargeCard",             startLine: 42, endLine: 56, kind: "function", exported: false },
    { id: "src/checkout/receipt.ts#generateReceipt",   filePath: "src/checkout/receipt.ts",   symbolName: "generateReceipt",        startLine: 1,  endLine: 18, kind: "function", exported: true },
    { id: "src/checkout/receipt.ts#formatLineItems",   filePath: "src/checkout/receipt.ts",   symbolName: "formatLineItems",        startLine: 20, endLine: 34, kind: "function", exported: false },

    // ── components module ────────────────────────────────────────
    { id: "src/components/LoginForm.ts#LoginForm.onSubmit",       filePath: "src/components/LoginForm.ts",   symbolName: "LoginForm.onSubmit",       startLine: 15, endLine: 30, kind: "method", exported: true },
    { id: "src/components/LoginForm.ts#LoginForm.validate",       filePath: "src/components/LoginForm.ts",   symbolName: "LoginForm.validate",       startLine: 32, endLine: 42, kind: "method", exported: false },
    { id: "src/components/Dashboard.ts#Dashboard.loadDashboard",  filePath: "src/components/Dashboard.ts",   symbolName: "Dashboard.loadDashboard",  startLine: 8,  endLine: 36, kind: "method", exported: true },
    { id: "src/components/Dashboard.ts#Dashboard.renderStats",    filePath: "src/components/Dashboard.ts",   symbolName: "Dashboard.renderStats",    startLine: 38, endLine: 52, kind: "method", exported: false },
    { id: "src/components/OrderList.ts#OrderList.renderOrders",   filePath: "src/components/OrderList.ts",   symbolName: "OrderList.renderOrders",   startLine: 5,  endLine: 25, kind: "method", exported: true },
    { id: "src/components/CartView.ts#CartView.checkout",         filePath: "src/components/CartView.ts",    symbolName: "CartView.checkout",        startLine: 10, endLine: 35, kind: "method", exported: true },
    { id: "src/components/CartView.ts#CartView.updateQuantity",   filePath: "src/components/CartView.ts",    symbolName: "CartView.updateQuantity",  startLine: 37, endLine: 48, kind: "method", exported: false },

    // ── utils module ─────────────────────────────────────────────
    { id: "src/utils/logger.ts#log",                   filePath: "src/utils/logger.ts",       symbolName: "log",                    startLine: 1,  endLine: 8,  kind: "arrow",    exported: true },
    { id: "src/utils/logger.ts#logError",              filePath: "src/utils/logger.ts",       symbolName: "logError",               startLine: 10, endLine: 18, kind: "arrow",    exported: true },
    { id: "src/utils/format.ts#formatCurrency",        filePath: "src/utils/format.ts",       symbolName: "formatCurrency",         startLine: 1,  endLine: 8,  kind: "arrow",    exported: true },
    { id: "src/utils/format.ts#formatDate",            filePath: "src/utils/format.ts",       symbolName: "formatDate",             startLine: 10, endLine: 18, kind: "arrow",    exported: true },
    { id: "src/utils/validate.ts#isEmail",             filePath: "src/utils/validate.ts",     symbolName: "isEmail",                startLine: 1,  endLine: 6,  kind: "arrow",    exported: true },
    { id: "src/utils/validate.ts#sanitizeInput",       filePath: "src/utils/validate.ts",     symbolName: "sanitizeInput",          startLine: 8,  endLine: 14, kind: "arrow",    exported: false },
  ],

  edges: [
    // ── LoginForm → auth flow ──
    { callerId: "src/components/LoginForm.ts#LoginForm.onSubmit",   calleeId: "src/components/LoginForm.ts#LoginForm.validate" },
    { callerId: "src/components/LoginForm.ts#LoginForm.validate",   calleeId: "src/utils/validate.ts#isEmail" },
    { callerId: "src/components/LoginForm.ts#LoginForm.validate",   calleeId: "src/utils/validate.ts#sanitizeInput" },
    { callerId: "src/components/LoginForm.ts#LoginForm.onSubmit",   calleeId: "src/auth/login.ts#handleLogin" },

    // ── handleLogin internals ──
    { callerId: "src/auth/login.ts#handleLogin",                    calleeId: "src/auth/login.ts#validateCredentials" },
    { callerId: "src/auth/login.ts#handleLogin",                    calleeId: "src/auth/session.ts#createSession" },
    { callerId: "src/auth/login.ts#handleLogin",                    calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/auth/login.ts#validateCredentials",            calleeId: "src/utils/validate.ts#isEmail" },

    // ── session → token ──
    { callerId: "src/auth/session.ts#createSession",                calleeId: "src/auth/token.ts#generateToken" },
    { callerId: "src/auth/session.ts#refreshSession",               calleeId: "src/auth/token.ts#verifyToken" },
    { callerId: "src/auth/session.ts#refreshSession",               calleeId: "src/auth/token.ts#generateToken" },
    { callerId: "src/auth/session.ts#destroySession",               calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/auth/token.ts#verifyToken",                    calleeId: "src/auth/token.ts#decodePayload" },

    // ── Dashboard → API + store ──
    { callerId: "src/components/Dashboard.ts#Dashboard.loadDashboard", calleeId: "src/api/client.ts#fetchUser" },
    { callerId: "src/components/Dashboard.ts#Dashboard.loadDashboard", calleeId: "src/api/client.ts#fetchOrders" },
    { callerId: "src/components/Dashboard.ts#Dashboard.loadDashboard", calleeId: "src/components/Dashboard.ts#Dashboard.renderStats" },
    { callerId: "src/components/Dashboard.ts#Dashboard.renderStats",   calleeId: "src/utils/format.ts#formatCurrency" },
    { callerId: "src/components/Dashboard.ts#Dashboard.renderStats",   calleeId: "src/utils/format.ts#formatDate" },

    // ── API client internals ──
    { callerId: "src/api/client.ts#fetchUser",                      calleeId: "src/api/middleware.ts#withAuth" },
    { callerId: "src/api/client.ts#fetchUser",                      calleeId: "src/api/middleware.ts#rateLimiter" },
    { callerId: "src/api/client.ts#fetchUser",                      calleeId: "src/store/userStore.ts#setUser" },
    { callerId: "src/api/client.ts#fetchOrders",                    calleeId: "src/api/middleware.ts#withAuth" },
    { callerId: "src/api/client.ts#fetchOrders",                    calleeId: "src/api/middleware.ts#rateLimiter" },
    { callerId: "src/api/client.ts#postOrder",                      calleeId: "src/api/middleware.ts#withAuth" },
    { callerId: "src/api/client.ts#postOrder",                      calleeId: "src/api/middleware.ts#buildHeaders" },
    { callerId: "src/api/client.ts#postOrder",                      calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/api/client.ts#deleteOrder",                    calleeId: "src/api/middleware.ts#withAuth" },
    { callerId: "src/api/client.ts#deleteOrder",                    calleeId: "src/utils/logger.ts#log" },

    // ── middleware → auth ──
    { callerId: "src/api/middleware.ts#withAuth",                    calleeId: "src/auth/token.ts#verifyToken" },
    { callerId: "src/api/middleware.ts#buildHeaders",                calleeId: "src/auth/token.ts#generateToken" },

    // ── OrderList → API ──
    { callerId: "src/components/OrderList.ts#OrderList.renderOrders", calleeId: "src/api/client.ts#fetchOrders" },
    { callerId: "src/components/OrderList.ts#OrderList.renderOrders", calleeId: "src/utils/format.ts#formatCurrency" },

    // ── CartView → cart + checkout ──
    { callerId: "src/components/CartView.ts#CartView.checkout",       calleeId: "src/checkout/checkout.ts#startCheckout" },
    { callerId: "src/components/CartView.ts#CartView.updateQuantity", calleeId: "src/cart/cartStore.ts#addToCart" },
    { callerId: "src/components/CartView.ts#CartView.updateQuantity", calleeId: "src/cart/pricing.ts#calculateTotal" },

    // ── checkout flow ──
    { callerId: "src/checkout/checkout.ts#startCheckout",            calleeId: "src/checkout/checkout.ts#validateCart" },
    { callerId: "src/checkout/checkout.ts#startCheckout",            calleeId: "src/cart/pricing.ts#calculateTotal" },
    { callerId: "src/checkout/checkout.ts#startCheckout",            calleeId: "src/checkout/payment.ts#processPayment" },
    { callerId: "src/checkout/checkout.ts#startCheckout",            calleeId: "src/checkout/receipt.ts#generateReceipt" },
    { callerId: "src/checkout/checkout.ts#startCheckout",            calleeId: "src/api/client.ts#postOrder" },
    { callerId: "src/checkout/checkout.ts#startCheckout",            calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/checkout/checkout.ts#validateCart",              calleeId: "src/cart/cartStore.ts#getCartItems" },

    // ── pricing internals ──
    { callerId: "src/cart/pricing.ts#calculateTotal",                calleeId: "src/cart/pricing.ts#calculateSubtotal" },
    { callerId: "src/cart/pricing.ts#calculateTotal",                calleeId: "src/cart/pricing.ts#applyDiscount" },
    { callerId: "src/cart/pricing.ts#calculateTotal",                calleeId: "src/cart/pricing.ts#calculateTax" },
    { callerId: "src/cart/pricing.ts#calculateSubtotal",             calleeId: "src/utils/format.ts#formatCurrency" },

    // ── payment internals ──
    { callerId: "src/checkout/payment.ts#processPayment",            calleeId: "src/checkout/payment.ts#validateCard" },
    { callerId: "src/checkout/payment.ts#processPayment",            calleeId: "src/checkout/payment.ts#chargeCard" },
    { callerId: "src/checkout/payment.ts#processPayment",            calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/checkout/payment.ts#chargeCard",                calleeId: "src/utils/logger.ts#logError" },

    // ── receipt internals ──
    { callerId: "src/checkout/receipt.ts#generateReceipt",           calleeId: "src/checkout/receipt.ts#formatLineItems" },
    { callerId: "src/checkout/receipt.ts#generateReceipt",           calleeId: "src/utils/format.ts#formatCurrency" },
    { callerId: "src/checkout/receipt.ts#generateReceipt",           calleeId: "src/utils/format.ts#formatDate" },
    { callerId: "src/checkout/receipt.ts#formatLineItems",           calleeId: "src/utils/format.ts#formatCurrency" },

    // ── cart store → logger ──
    { callerId: "src/cart/cartStore.ts#addToCart",                   calleeId: "src/utils/logger.ts#log" },
    { callerId: "src/cart/cartStore.ts#removeFromCart",              calleeId: "src/utils/logger.ts#log" },
  ],

  testFiles: [
    {
      path: "src/auth/__tests__/login.test.ts",
      linkedNodeIds: [
        "src/auth/login.ts#handleLogin",
        "src/auth/login.ts#validateCredentials",
        "src/auth/session.ts#createSession",
        "src/auth/token.ts#generateToken",
        "src/utils/logger.ts#log",
        "src/utils/validate.ts#isEmail",
      ],
    },
    {
      path: "src/auth/__tests__/session.test.ts",
      linkedNodeIds: [
        "src/auth/session.ts#createSession",
        "src/auth/session.ts#refreshSession",
        "src/auth/session.ts#destroySession",
        "src/auth/token.ts#generateToken",
        "src/auth/token.ts#verifyToken",
        "src/auth/token.ts#decodePayload",
      ],
    },
    {
      path: "src/auth/__tests__/token.test.ts",
      linkedNodeIds: [
        "src/auth/token.ts#generateToken",
        "src/auth/token.ts#verifyToken",
        "src/auth/token.ts#decodePayload",
      ],
    },
    {
      path: "src/api/__tests__/client.test.ts",
      linkedNodeIds: [
        "src/api/client.ts#fetchUser",
        "src/api/client.ts#fetchOrders",
        "src/api/client.ts#postOrder",
        "src/api/client.ts#deleteOrder",
        "src/api/middleware.ts#withAuth",
        "src/api/middleware.ts#rateLimiter",
        "src/api/middleware.ts#buildHeaders",
        "src/auth/token.ts#verifyToken",
        "src/auth/token.ts#generateToken",
      ],
    },
    {
      path: "src/api/__tests__/middleware.test.ts",
      linkedNodeIds: [
        "src/api/middleware.ts#withAuth",
        "src/api/middleware.ts#rateLimiter",
        "src/api/middleware.ts#buildHeaders",
        "src/auth/token.ts#verifyToken",
        "src/auth/token.ts#generateToken",
        "src/auth/token.ts#decodePayload",
      ],
    },
    {
      path: "src/cart/__tests__/pricing.test.ts",
      linkedNodeIds: [
        "src/cart/pricing.ts#calculateTotal",
        "src/cart/pricing.ts#calculateSubtotal",
        "src/cart/pricing.ts#applyDiscount",
        "src/cart/pricing.ts#calculateTax",
        "src/utils/format.ts#formatCurrency",
      ],
    },
    {
      path: "src/cart/__tests__/cartStore.test.ts",
      linkedNodeIds: [
        "src/cart/cartStore.ts#addToCart",
        "src/cart/cartStore.ts#removeFromCart",
        "src/cart/cartStore.ts#getCartItems",
        "src/utils/logger.ts#log",
      ],
    },
    {
      path: "src/checkout/__tests__/checkout.test.ts",
      linkedNodeIds: [
        "src/checkout/checkout.ts#startCheckout",
        "src/checkout/checkout.ts#validateCart",
        "src/checkout/payment.ts#processPayment",
        "src/checkout/payment.ts#validateCard",
        "src/checkout/payment.ts#chargeCard",
        "src/checkout/receipt.ts#generateReceipt",
        "src/checkout/receipt.ts#formatLineItems",
        "src/cart/pricing.ts#calculateTotal",
        "src/cart/pricing.ts#calculateSubtotal",
        "src/cart/pricing.ts#applyDiscount",
        "src/cart/pricing.ts#calculateTax",
        "src/cart/cartStore.ts#getCartItems",
        "src/api/client.ts#postOrder",
        "src/utils/logger.ts#log",
        "src/utils/format.ts#formatCurrency",
        "src/utils/format.ts#formatDate",
      ],
    },
  ],

  featureModules: ["auth", "api", "cart", "checkout", "components", "utils"],
};

// ── Pre-built highlight responses for demo scenarios ──────────────
// These let you click specific nodes in dev mode and see a realistic
// blast radius without a running extension host.

var MOCK_HIGHLIGHTS = {

  // ★ Hero demo: click calculateTotal → deep downstream into pricing,
  //   upstream into checkout + CartView, 3 test files, 4 modules at risk.
  "src/cart/pricing.ts#calculateTotal": {
    type: "highlight",
    selectedNodeId: "src/cart/pricing.ts#calculateTotal",
    downstream: [
      "src/cart/pricing.ts#calculateSubtotal",
      "src/cart/pricing.ts#applyDiscount",
      "src/cart/pricing.ts#calculateTax",
      "src/utils/format.ts#formatCurrency",
    ],
    upstream: [
      "src/checkout/checkout.ts#startCheckout",
      "src/components/CartView.ts#CartView.checkout",
      "src/components/CartView.ts#CartView.updateQuantity",
    ],
    linkedTests: [
      "src/cart/__tests__/pricing.test.ts",
      "src/checkout/__tests__/checkout.test.ts",
    ],
    affectedModules: ["cart", "checkout", "components", "utils"],
    affectedCount: 7,
  },

  // ★ Auth deep-dive: click withAuth → shows how middleware fans out
  //   to every API endpoint and up through all components.
  "src/api/middleware.ts#withAuth": {
    type: "highlight",
    selectedNodeId: "src/api/middleware.ts#withAuth",
    downstream: [
      "src/auth/token.ts#verifyToken",
      "src/auth/token.ts#decodePayload",
    ],
    upstream: [
      "src/api/client.ts#fetchUser",
      "src/api/client.ts#fetchOrders",
      "src/api/client.ts#postOrder",
      "src/api/client.ts#deleteOrder",
      "src/components/Dashboard.ts#Dashboard.loadDashboard",
      "src/components/OrderList.ts#OrderList.renderOrders",
      "src/components/CartView.ts#CartView.checkout",
      "src/checkout/checkout.ts#startCheckout",
    ],
    linkedTests: [
      "src/api/__tests__/client.test.ts",
      "src/api/__tests__/middleware.test.ts",
    ],
    affectedModules: ["api", "auth", "components", "checkout"],
    affectedCount: 10,
  },

  // ★ Full checkout flow: startCheckout touches almost everything.
  "src/checkout/checkout.ts#startCheckout": {
    type: "highlight",
    selectedNodeId: "src/checkout/checkout.ts#startCheckout",
    downstream: [
      "src/checkout/checkout.ts#validateCart",
      "src/cart/cartStore.ts#getCartItems",
      "src/cart/pricing.ts#calculateTotal",
      "src/cart/pricing.ts#calculateSubtotal",
      "src/cart/pricing.ts#applyDiscount",
      "src/cart/pricing.ts#calculateTax",
      "src/checkout/payment.ts#processPayment",
      "src/checkout/payment.ts#validateCard",
      "src/checkout/payment.ts#chargeCard",
      "src/checkout/receipt.ts#generateReceipt",
      "src/checkout/receipt.ts#formatLineItems",
      "src/api/client.ts#postOrder",
      "src/api/middleware.ts#withAuth",
      "src/api/middleware.ts#buildHeaders",
      "src/auth/token.ts#verifyToken",
      "src/auth/token.ts#decodePayload",
      "src/auth/token.ts#generateToken",
      "src/utils/logger.ts#log",
      "src/utils/logger.ts#logError",
      "src/utils/format.ts#formatCurrency",
      "src/utils/format.ts#formatDate",
    ],
    upstream: [
      "src/components/CartView.ts#CartView.checkout",
    ],
    linkedTests: [
      "src/checkout/__tests__/checkout.test.ts",
      "src/cart/__tests__/pricing.test.ts",
      "src/api/__tests__/client.test.ts",
    ],
    affectedModules: ["checkout", "cart", "api", "auth", "utils", "components"],
    affectedCount: 22,
  },

  // ★ Leaf node: click a utility like formatCurrency → no downstream,
  //   but massive upstream fan-in from everywhere that formats money.
  "src/utils/format.ts#formatCurrency": {
    type: "highlight",
    selectedNodeId: "src/utils/format.ts#formatCurrency",
    downstream: [],
    upstream: [
      "src/cart/pricing.ts#calculateSubtotal",
      "src/cart/pricing.ts#calculateTotal",
      "src/checkout/receipt.ts#generateReceipt",
      "src/checkout/receipt.ts#formatLineItems",
      "src/components/Dashboard.ts#Dashboard.renderStats",
      "src/components/OrderList.ts#OrderList.renderOrders",
    ],
    linkedTests: [
      "src/cart/__tests__/pricing.test.ts",
      "src/checkout/__tests__/checkout.test.ts",
    ],
    affectedModules: ["cart", "checkout", "components"],
    affectedCount: 6,
  },

  // ★ Login flow: handleLogin → auth chain + session + token.
  "src/auth/login.ts#handleLogin": {
    type: "highlight",
    selectedNodeId: "src/auth/login.ts#handleLogin",
    downstream: [
      "src/auth/login.ts#validateCredentials",
      "src/auth/session.ts#createSession",
      "src/auth/token.ts#generateToken",
      "src/utils/logger.ts#log",
      "src/utils/validate.ts#isEmail",
    ],
    upstream: [
      "src/components/LoginForm.ts#LoginForm.onSubmit",
    ],
    linkedTests: [
      "src/auth/__tests__/login.test.ts",
    ],
    affectedModules: ["auth", "utils", "components"],
    affectedCount: 6,
  },
};
