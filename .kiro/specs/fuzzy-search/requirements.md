# Requirements Document

## Introduction

The Blast Radius VS Code extension currently requires users to visually locate and click function nodes in the Cytoscape.js graph to explore blast radius information. As graphs grow large, finding a specific function, test file, or module becomes difficult. This feature adds a fuzzy search capability that lets users type an approximate name and quickly locate matching nodes, test files, and modules within the graph visualization. The search runs entirely within the webview using in-memory data — no external network calls are made.

## Glossary

- **Search_Input**: The text input field rendered in the webview where users type search queries
- **Search_Engine**: The fuzzy matching module that scores and ranks candidate items against a query string
- **Search_Result**: A single item returned by the Search_Engine, containing the matched item's identity, display label, category, and relevance score
- **Result_List**: The ordered dropdown UI element that displays Search_Results below the Search_Input
- **Graph_Node**: A Cytoscape.js node element in the webview representing a function, method, or test file
- **Node_ID**: The unique identifier for a function node, formatted as `{relativePath}#{symbolName}`
- **Webview**: The VS Code webview panel that renders the Cytoscape.js graph and all search UI
- **Extension_Host**: The VS Code extension backend process that sends graph data to the Webview via postMessage
- **Category**: A classification label for a Search_Result — one of "function", "test", or "module"

## Requirements

### Requirement 1: Search Input Field

**User Story:** As a developer, I want a persistent search input field in the graph view, so that I can quickly start searching without navigating away from the visualization.

#### Acceptance Criteria

1. THE Webview SHALL render a Search_Input text field positioned at the top-center of the graph panel
2. WHEN the user presses the `/` key while the Search_Input is not focused, THE Webview SHALL focus the Search_Input
3. WHEN the user presses the `Escape` key while the Search_Input is focused, THE Webview SHALL clear the Search_Input text and return focus to the graph
4. THE Search_Input SHALL display placeholder text reading "Search functions, tests, modules…"
5. THE Search_Input SHALL be styled consistently with VS Code theme variables for foreground, background, and border colors

### Requirement 2: Searchable Item Index

**User Story:** As a developer, I want the search to cover all functions, test files, and feature modules in my project, so that I can find any entity in the graph.

#### Acceptance Criteria

1. WHEN graph data is received from the Extension_Host, THE Search_Engine SHALL build a searchable index containing all function Graph_Nodes, all test file Graph_Nodes, and all feature module names
2. THE Search_Engine SHALL index each function Graph_Node using both the symbol name and the file path from the Node_ID
3. THE Search_Engine SHALL index each test file using the test file path
4. THE Search_Engine SHALL index each feature module using the module name
5. WHEN updated graph data is received from the Extension_Host, THE Search_Engine SHALL rebuild the searchable index to reflect the new data

### Requirement 3: Fuzzy Matching Algorithm

**User Story:** As a developer, I want the search to tolerate typos and partial input, so that I can find nodes without remembering exact names.

#### Acceptance Criteria

1. THE Search_Engine SHALL perform substring and character-sequence fuzzy matching against indexed items
2. THE Search_Engine SHALL assign a relevance score to each Search_Result based on match quality, where exact prefix matches score higher than substring matches, and substring matches score higher than non-contiguous character matches
3. THE Search_Engine SHALL rank Search_Results in descending order of relevance score
4. WHEN two Search_Results have equal relevance scores, THE Search_Engine SHALL break ties by alphabetical order of the display label
5. THE Search_Engine SHALL match queries in a case-insensitive manner
6. FOR ALL indexed items, searching with the exact full label of an item SHALL return that item as the top-ranked Search_Result (round-trip property)

### Requirement 4: Search Result Display

**User Story:** As a developer, I want to see categorized search results as I type, so that I can quickly identify and select the right item.

#### Acceptance Criteria

1. WHEN the user types at least one character in the Search_Input, THE Result_List SHALL display matching Search_Results grouped by Category in the order: functions, tests, modules
2. THE Result_List SHALL display a maximum of 20 Search_Results across all categories
3. WHEN no Search_Results match the query, THE Result_List SHALL display the text "No results found"
4. THE Result_List SHALL display each Search_Result with the matched item's display label and its Category
5. THE Result_List SHALL highlight the matched character positions within each Search_Result display label
6. WHEN the Search_Input is cleared or empty, THE Result_List SHALL be hidden
7. THE Result_List SHALL render within 100 milliseconds of the last keystroke for queries against graphs containing up to 1000 indexed items

### Requirement 5: Result Selection and Graph Navigation

**User Story:** As a developer, I want to select a search result and have the graph navigate to that node, so that I can inspect its blast radius.

#### Acceptance Criteria

1. WHEN the user clicks a function Search_Result, THE Webview SHALL select the corresponding Graph_Node, center the viewport on the Graph_Node, and trigger a node-click event for blast radius computation
2. WHEN the user clicks a test file Search_Result, THE Webview SHALL select the corresponding test Graph_Node and center the viewport on the Graph_Node
3. WHEN the user clicks a module Search_Result, THE Webview SHALL fit the viewport to show all Graph_Nodes belonging to that module
4. WHEN the user presses the `Enter` key while the Result_List is visible, THE Webview SHALL select the first Search_Result in the Result_List
5. THE Webview SHALL support keyboard navigation of the Result_List using the `ArrowUp` and `ArrowDown` keys to move the active highlight between Search_Results
6. WHEN a Search_Result is selected, THE Webview SHALL close the Result_List and clear the Search_Input

### Requirement 6: Search State and Graph Interaction

**User Story:** As a developer, I want the search to work seamlessly alongside existing graph interactions, so that my workflow is not disrupted.

#### Acceptance Criteria

1. WHILE the Result_List is visible, THE Webview SHALL prevent click events on the Result_List from propagating to the Cytoscape.js graph canvas
2. WHEN the user clicks outside the Search_Input and Result_List, THE Webview SHALL close the Result_List
3. WHILE a blast radius highlight is active, THE Search_Engine SHALL still return results from all indexed items, not only highlighted items
4. WHEN the user selects a function Search_Result while a blast radius highlight is active, THE Webview SHALL replace the current highlight with the blast radius of the newly selected Graph_Node

### Requirement 7: Data Privacy

**User Story:** As a developer, I want the search to operate entirely locally, so that no code or project data leaves my machine.

#### Acceptance Criteria

1. THE Search_Engine SHALL execute all fuzzy matching logic within the Webview using only in-memory graph data received via postMessage
2. THE Search_Engine SHALL make zero external network requests
3. THE Search_Engine SHALL not transmit any search queries or graph data outside the Webview

### Requirement 8: Search Result Formatting

**User Story:** As a developer, I want search results to show enough context to distinguish similarly named items, so that I select the correct one.

#### Acceptance Criteria

1. THE Result_List SHALL display function Search_Results with the symbol name as the primary label and the file path as a secondary label
2. THE Result_List SHALL display test file Search_Results with the test file name as the primary label and the full relative path as a secondary label
3. THE Result_List SHALL display module Search_Results with the module name as the primary label
4. THE Result_List SHALL display a Category icon or badge next to each Search_Result to visually distinguish functions, tests, and modules
