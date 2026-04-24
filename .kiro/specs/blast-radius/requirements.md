# Requirements Document

## Introduction

Blast Radius is a VSCode-compatible extension that visualizes the impact of code changes in TypeScript projects. Given a selected function, the extension builds a static call graph, maps Jest tests to source functions, and renders an interactive dependency graph inside the IDE. The goal is to help developers answer "if I change this, what breaks?" without leaving their editor or running the full test suite.

## Glossary

- **Extension**: The Blast Radius VSCode extension running in the extension host process
- **Code_Parser**: The module that uses the TypeScript Compiler API to walk source files and extract function definitions and call sites
- **Graph_Builder**: The module that constructs an in-memory call graph from parsed function definitions and call sites
- **Call_Graph**: A directed graph data structure where nodes represent functions or methods and edges represent direct call relationships between them
- **Function_Node**: A node in the Call_Graph representing a single function or method, qualified by file path and symbol name
- **Call_Edge**: A directed edge in the Call_Graph from a caller Function_Node to a callee Function_Node
- **Test_Mapper**: The module that parses Jest test files and maps them to source functions via import resolution and transitive call graph traversal
- **Test_Map**: A data structure mapping each test file to the set of Function_Nodes it exercises, resolved transitively through the Call_Graph
- **Impact_Engine**: The module that computes upstream nodes, downstream nodes, and linked test files for a selected Function_Node
- **Webview_Panel**: The VSCode webview panel titled "Blast Radius" that renders the interactive graph using Cytoscape.js
- **Impact_Summary**: A sidebar section within the Webview_Panel displaying counts of affected functions, recommended test files, and at-risk feature modules
- **Feature_Module**: A top-level directory under `src/` treated as a logical grouping of related functionality
- **Downstream_Node**: A Function_Node that is transitively called by a selected Function_Node
- **Upstream_Node**: A Function_Node that transitively calls a selected Function_Node
- **Workspace_Root**: The root directory of the currently open VSCode workspace

## Requirements

### Requirement 1: Command Registration

**User Story:** As a developer, I want to open the Blast Radius graph from the command palette, so that I can visualize code dependencies on demand.

#### Acceptance Criteria

1. THE Extension SHALL register a VSCode command with the identifier `blast-radius.open` and the command palette label "Blast Radius: Open Graph"
2. WHEN the `blast-radius.open` command is invoked, THE Extension SHALL create and display the Webview_Panel
3. THE Extension SHALL activate only when the `blast-radius.open` command is invoked, not on editor startup

### Requirement 2: TypeScript Source Parsing

**User Story:** As a developer, I want the extension to parse my TypeScript project automatically, so that I can see all function relationships without manual configuration.

#### Acceptance Criteria

1. WHEN the `blast-radius.open` command is invoked, THE Code_Parser SHALL parse all `.ts` files under the Workspace_Root `src/` directory using the TypeScript Compiler API
2. THE Code_Parser SHALL extract named function declarations, arrow functions assigned to `const` or `let` variables, class method declarations, and exported functions as Function_Nodes
3. THE Code_Parser SHALL extract direct call sites from function bodies and record each as a Call_Edge linking the calling Function_Node to the called Function_Node
4. THE Code_Parser SHALL qualify each Function_Node with its file path relative to the Workspace_Root and its symbol name
5. THE Code_Parser SHALL skip dynamic calls via string-keyed property access, `eval` invocations, and framework-injected callbacks, and document these as known limitations

### Requirement 3: Call Graph Construction

**User Story:** As a developer, I want a complete call graph built from parsed data, so that I can trace how functions depend on each other.

#### Acceptance Criteria

1. WHEN the Code_Parser completes parsing, THE Graph_Builder SHALL construct a Call_Graph containing all extracted Function_Nodes and Call_Edges
2. THE Graph_Builder SHALL produce a Call_Graph with no duplicate Function_Nodes for the same file path and symbol name combination
3. THE Graph_Builder SHALL complete Call_Graph construction for a project with 100 source files in 10 seconds or less

### Requirement 4: Jest Test File Parsing

**User Story:** As a developer, I want the extension to discover my Jest tests, so that I can see which tests cover which functions.

#### Acceptance Criteria

1. WHEN the `blast-radius.open` command is invoked, THE Test_Mapper SHALL parse all files matching `*.test.ts` and `*.spec.ts` patterns in the Workspace_Root
2. THE Test_Mapper SHALL extract import statements from each test file and resolve imported symbols to their corresponding Function_Nodes in the Call_Graph

### Requirement 5: Transitive Test-to-Source Mapping

**User Story:** As a developer, I want to know all tests that exercise a given function, including tests that reach it indirectly through the call chain, so that I can run only the relevant tests.

#### Acceptance Criteria

1. THE Test_Mapper SHALL produce a Test_Map that maps each test file to the set of Function_Nodes reachable from its direct imports by traversing Call_Edges transitively in the Call_Graph
2. WHEN given a Function_Node, THE Impact_Engine SHALL return the set of test files from the Test_Map whose transitive Function_Node sets include that Function_Node
3. FOR ALL Function_Nodes that are directly imported by a test file, THE Test_Map SHALL include that Function_Node in the mapped set for that test file

### Requirement 6: Webview Panel Rendering

**User Story:** As a developer, I want to see the call graph as an interactive visual diagram inside my editor, so that I can explore dependencies without switching tools.

#### Acceptance Criteria

1. WHEN the Webview_Panel is created, THE Webview_Panel SHALL render the Call_Graph and Test_Map data using the Cytoscape.js library bundled within the extension
2. THE Webview_Panel SHALL display the panel with the title "Blast Radius"
3. THE Webview_Panel SHALL support pan, zoom, and fit-to-screen interactions on the rendered graph
4. THE Webview_Panel SHALL visually distinguish source Function_Nodes, test file nodes, and Feature_Module nodes using distinct colors or shapes
5. THE Webview_Panel SHALL render a graph containing 200 nodes at 30 frames per second or higher

### Requirement 7: Graph Data Communication

**User Story:** As a developer, I want the graph data to load seamlessly into the webview, so that I see an up-to-date visualization each time I open the panel.

#### Acceptance Criteria

1. WHEN the Call_Graph and Test_Map are constructed, THE Extension SHALL transmit the graph data to the Webview_Panel using the VSCode `postMessage` API
2. WHEN the Webview_Panel receives graph data via `postMessage`, THE Webview_Panel SHALL render the received nodes and edges

### Requirement 8: Blast Radius Highlight on Node Click

**User Story:** As a developer, I want to click a function node and see its full blast radius highlighted, so that I can understand the scope of a potential change.

#### Acceptance Criteria

1. WHEN a user clicks a Function_Node in the Webview_Panel, THE Webview_Panel SHALL send a message to the Extension identifying the clicked node
2. WHEN the Extension receives a node click message, THE Impact_Engine SHALL compute the set of Downstream_Nodes, Upstream_Nodes, and linked test files for the clicked Function_Node
3. WHEN the Impact_Engine returns results, THE Extension SHALL send highlight instructions to the Webview_Panel via `postMessage`
4. THE Webview_Panel SHALL highlight Downstream_Nodes in a first distinct color, Upstream_Nodes in a second distinct color, and linked test file nodes in a third distinct color
5. THE Webview_Panel SHALL dim all nodes that are not the selected node, a Downstream_Node, an Upstream_Node, or a linked test file node
6. THE Impact_Engine SHALL complete the blast radius computation and return results within 200 milliseconds

### Requirement 9: Impact Summary Display

**User Story:** As a developer, I want to see a summary of the blast radius including affected function count, recommended tests, and at-risk modules, so that I can make informed decisions about testing and release.

#### Acceptance Criteria

1. WHEN blast radius results are computed for a clicked node, THE Webview_Panel SHALL display an Impact_Summary section
2. THE Impact_Summary SHALL show the count of affected Function_Nodes (combined Upstream_Nodes and Downstream_Nodes)
3. THE Impact_Summary SHALL list the file paths of all recommended Jest test files linked to the selected Function_Node
4. THE Impact_Summary SHALL list all Feature_Modules at risk, inferred from the top-level directories under `src/` that contain affected Function_Nodes

### Requirement 10: Feature Module Inference

**User Story:** As a developer, I want the extension to automatically identify feature modules from my project structure, so that I can see which features are at risk without manual configuration.

#### Acceptance Criteria

1. THE Impact_Engine SHALL treat each top-level directory under `src/` in the Workspace_Root as a Feature_Module
2. WHEN computing blast radius results, THE Impact_Engine SHALL identify a Feature_Module as at risk if any Function_Node within that Feature_Module directory is in the set of Downstream_Nodes or Upstream_Nodes

### Requirement 11: Data Privacy Enforcement

**User Story:** As a developer, I want assurance that my source code and dependency data stay local, so that I can use the extension without security concerns.

#### Acceptance Criteria

1. THE Extension SHALL NOT transmit source code, file names, or Call_Graph data to any external service
2. THE Extension SHALL perform all parsing, graph construction, and impact analysis locally within the extension host process
3. WHEN the Webview_Panel initializes, THE Extension SHALL verify that no network requests to non-`vscode://` and non-`file://` URIs are configured, and throw an error if any are detected

### Requirement 12: Call Graph Serialization Round-Trip

**User Story:** As a developer, I want the call graph data to be accurately transmitted between the extension host and the webview, so that the visualization faithfully represents the parsed code structure.

#### Acceptance Criteria

1. THE Graph_Builder SHALL serialize the Call_Graph into a JSON representation for transmission to the Webview_Panel
2. THE Webview_Panel SHALL deserialize the received JSON into a graph structure for rendering
3. FOR ALL valid Call_Graph objects, serializing to JSON and then deserializing SHALL produce a Call_Graph with the same set of Function_Nodes and Call_Edges as the original (round-trip property)
