import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { buildTestMap } from "../../parser/testMapper";
import { buildGraph } from "../../graph/graphBuilder";
import { parseProject } from "../../parser/codeParser";

/**
 * Unit tests for the Test Mapper (buildTestMap).
 *
 * Creates temporary workspaces with source files and test files,
 * then verifies that buildTestMap correctly resolves imports and
 * expands them transitively through the call graph.
 */
suite("Test Mapper", () => {
  let tmpDir: string;

  function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-radius-tm-"));
    const srcDir = path.join(dir, "src");
    fs.mkdirSync(srcDir, { recursive: true });

    const tsconfig = {
      compilerOptions: {
        module: "Node16",
        target: "ES2022",
        outDir: "out",
        rootDir: "src",
        strict: true,
        lib: ["ES2022"],
        moduleResolution: "Node16",
      },
    };
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    );

    return dir;
  }

  function writeFile(workspace: string, relativePath: string, content: string): void {
    const fullPath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  function rmrf(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  setup(() => {
    tmpDir = createWorkspace();
  });

  teardown(() => {
    rmrf(tmpDir);
  });

  test("resolves direct imports from test files to graph nodes", () => {
    // Source file with an exported function
    writeFile(tmpDir, "src/math.ts", `
export function add(a: number, b: number): number {
  return a + b;
}
`);

    // Test file that imports the function
    writeFile(tmpDir, "src/math.test.ts", `
import { add } from "./math.js";

const result = add(1, 2);
`);

    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    const testKey = "src/math.test.ts";
    assert.ok(testMap.mapping.has(testKey), "should have entry for test file");

    const covered = testMap.mapping.get(testKey)!;
    assert.ok(covered.has("src/math.ts#add"), "should resolve import to graph node");
  });

  test("expands imports transitively through call graph", () => {
    // Source: a calls b, b calls c
    writeFile(tmpDir, "src/chain.ts", `
export function c(): number { return 1; }
export function b(): number { return c(); }
export function a(): number { return b(); }
`);

    // Test imports only 'a'
    writeFile(tmpDir, "src/chain.test.ts", `
import { a } from "./chain.js";

const result = a();
`);

    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    const covered = testMap.mapping.get("src/chain.test.ts")!;
    assert.ok(covered.has("src/chain.ts#a"), "should include directly imported 'a'");
    assert.ok(covered.has("src/chain.ts#b"), "should include transitively reachable 'b'");
    assert.ok(covered.has("src/chain.ts#c"), "should include transitively reachable 'c'");
  });

  test("test files with no matching imports produce empty sets", () => {
    // Source file
    writeFile(tmpDir, "src/utils.ts", `
export function helper(): void {}
`);

    // Test file that does not import anything from the graph
    writeFile(tmpDir, "src/empty.test.ts", `
const x = 42;
`);

    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    const covered = testMap.mapping.get("src/empty.test.ts");
    assert.ok(covered !== undefined, "should have entry for test file");
    assert.strictEqual(covered!.size, 0, "should have empty coverage set");
  });

  test("returns empty mapping when no test files exist", () => {
    writeFile(tmpDir, "src/app.ts", `
export function main(): void {}
`);

    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    assert.strictEqual(testMap.mapping.size, 0, "should have no entries");
  });
});
