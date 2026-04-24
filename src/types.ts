export interface FunctionNode {
  id: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  kind: "function" | "arrow" | "method";
}

export interface CallEdge {
  callerId: string;
  calleeId: string;
}

export interface ParseResult {
  nodes: FunctionNode[];
  edges: CallEdge[];
}

export interface CallGraph {
  nodes: Map<string, FunctionNode>;
  forward: Map<string, Set<string>>;
  reverse: Map<string, Set<string>>;
}

export interface TestMap {
  mapping: Map<string, Set<string>>;
}

export interface BlastRadiusResult {
  selectedNodeId: string;
  downstream: Set<string>;
  upstream: Set<string>;
  linkedTests: string[];
  affectedModules: string[];
  affectedCount: number;
}

export interface SerializedFunctionNode {
  id: string;
  filePath: string;
  symbolName: string;
  startLine: number;
  endLine: number;
  kind: "function" | "arrow" | "method";
}

export interface SerializedCallEdge {
  callerId: string;
  calleeId: string;
}

export interface SerializedCallGraph {
  nodes: SerializedFunctionNode[];
  edges: SerializedCallEdge[];
}

export interface SerializedTestMap {
  entries: { testFile: string; functionNodeIds: string[] }[];
}

export interface GraphDataMessage {
  type: "graph-data";
  nodes: SerializedFunctionNode[];
  edges: SerializedCallEdge[];
  testFiles: { path: string; linkedNodeIds: string[] }[];
  featureModules: string[];
}

export interface HighlightMessage {
  type: "highlight";
  selectedNodeId: string;
  downstream: string[];
  upstream: string[];
  linkedTests: string[];
  affectedModules: string[];
  affectedCount: number;
}

export interface NodeClickMessage {
  type: "node-click";
  nodeId: string;
}
