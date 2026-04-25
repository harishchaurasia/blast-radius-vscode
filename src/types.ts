/**
 * Core type definitions for the Blast Radius extension.
 *
 * Node ID format: `{relativePath}#{symbolName}`
 *   - e.g. `src/cart/calc.ts#calculateTotal`
 *   - For class methods: `src/utils/math.ts#MathHelper.add` (ClassName.methodName)
 */

// ---------------------------------------------------------------------------
// Core data structures
// ---------------------------------------------------------------------------

/** A node in the call graph representing a single function or method. */
export interface FunctionNode {
  /** Unique identifier: relative file path + "#" + symbol name */
  id: string;
  /** File path relative to workspace root */
  filePath: string;
  /** Function/method name (for class methods: ClassName.methodName) */
  symbolName: string;
  /** Start line number (1-based) */
  startLine: number;
  /** End line number (1-based) */
  endLine: number;
  /** Node kind: named function, arrow function, class method */
  kind: "function" | "arrow" | "method";
}

/** A directed edge from a caller function node to a callee function node. */
export interface CallEdge {
  /** ID of the calling function node */
  callerId: string;
  /** ID of the called function node */
  calleeId: string;
}

/** Result of parsing all TypeScript source files. */
export interface ParseResult {
  nodes: FunctionNode[];
  edges: CallEdge[];
}

/** In-memory call graph with forward and reverse adjacency lists. */
export interface CallGraph {
  /** Map from node ID to FunctionNode */
  nodes: Map<string, FunctionNode>;
  /** Forward adjacency: caller ID → Set of callee IDs */
  forward: Map<string, Set<string>>;
  /** Reverse adjacency: callee ID → Set of caller IDs */
  reverse: Map<string, Set<string>>;
}

/** Mapping from test file paths to the set of function node IDs they exercise. */
export interface TestMap {
  /** Map from test file path to set of FunctionNode IDs reachable transitively */
  mapping: Map<string, Set<string>>;
}

/** Blast radius computation result for a selected node. */
export interface BlastRadiusResult {
  /** The selected node ID */
  selectedNodeId: string;
  /** IDs of all downstream nodes (transitively called by selected) */
  downstream: Set<string>;
  /** IDs of all upstream nodes (transitively calling selected) */
  upstream: Set<string>;
  /** Test file paths that exercise the selected node */
  linkedTests: string[];
  /** Feature module names at risk */
  affectedModules: string[];
  /** Total count of affected function nodes */
  affectedCount: number;
}

// ---------------------------------------------------------------------------
// Serialized variants (JSON-safe for postMessage transmission)
// ---------------------------------------------------------------------------

/** JSON-serializable form of FunctionNode. */
export interface SerializedFunctionNode {
  id: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  kind: "function" | "arrow" | "method";
}

/** JSON-serializable form of CallEdge. */
export interface SerializedCallEdge {
  callerId: string;
  calleeId: string;
}

/** JSON-serializable form of CallGraph. */
export interface SerializedCallGraph {
  nodes: SerializedFunctionNode[];
  edges: SerializedCallEdge[];
}

/** JSON-serializable form of TestMap. */
export interface SerializedTestMap {
  entries: { testFile: string; functionNodeIds: string[] }[];
}

// ---------------------------------------------------------------------------
// Webview ↔ Extension host message types
// ---------------------------------------------------------------------------

/** Message sent from extension host to webview with full graph data. */
export interface GraphDataMessage {
  type: "graph-data";
  nodes: SerializedFunctionNode[];
  edges: SerializedCallEdge[];
  testFiles: { path: string; linkedNodeIds: string[] }[];
  featureModules: string[];
}

/** Message sent from extension host to webview with highlight instructions. */
export interface HighlightMessage {
  type: "highlight";
  selectedNodeId: string;
  downstream: string[];
  upstream: string[];
  linkedTests: string[];
  affectedModules: string[];
  affectedCount: number;
}

/** Message sent from webview to extension host when a node is clicked. */
export interface NodeClickMessage {
  type: "node-click";
  nodeId: string;
}
