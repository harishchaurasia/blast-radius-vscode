import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { parseProject } from "../../parser/codeParser";

/**
 * Unit tests for the Code Parser (`parseProject`).
 *
 * Each test creates a temporary workspace with a tsconfig.json and fixture
 * source files under `src/`, invokes `parseProject`, and validates the
 * extracted FunctionNode entries and CallEdge entries.
 */
suite("Code Parser", () => {
  let tmpDir: string;

  /**
   * Create a temporary workspace directory with a tsconfig.json that
   * compiles src files.
   */
  function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-radius-test-"));
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
      },
    };
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2),
    );

    return dir;
  }

  /**
   * Write a TypeScript source file under the workspace src directory.
   */
  function writeSource(workspace: string, relativePath: string, content: string): void {
    const fullPath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  /**
   * Recursively remove a directory.
   */
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

  // -----------------------------------------------------------------------
  // Node extraction
  // -----------------------------------------------------------------------

  test("extracts named function declarations", () => {
    writeSource(tmpDir, "src/utils.ts", `
export function greet(name: string): string {
  return "Hello, " + name;
}

function helper(): void {}
`);

    const result = parseProject(tmpDir);

    const greetNode = result.nodes.find((n) => n.symbolName === "greet");
    const helperNode = result.nodes.find((n) => n.symbolName === "helper");

    assert.ok(greetNode, "should extract exported named function 'greet'");
    assert.strictEqual(greetNode!.kind, "function");
    assert.strictEqual(greetNode!.filePath, "src/utils.ts");
    assert.strictEqual(greetNode!.id, "src/utils.ts#greet");

    assert.ok(helperNode, "should extract non-exported named function 'helper'");
    assert.strictEqual(helperNode!.kind, "function");
  });

  test("extracts arrow functions assigned to const/let", () => {
    writeSource(tmpDir, "src/math.ts", `
export const add = (a: number, b: number): number => a + b;
const multiply = (a: number, b: number): number => a * b;
`);

    const result = parseProject(tmpDir);

    const addNode = result.nodes.find((n) => n.symbolName === "add");
    const mulNode = result.nodes.find((n) => n.symbolName === "multiply");

    assert.ok(addNode, "should extract exported arrow function 'add'");
    assert.strictEqual(addNode!.kind, "arrow");
    assert.strictEqual(addNode!.id, "src/math.ts#add");

    assert.ok(mulNode, "should extract non-exported arrow function 'multiply'");
    assert.strictEqual(mulNode!.kind, "arrow");
  });

  test("extracts class methods with ClassName.methodName format", () => {
    writeSource(tmpDir, "src/calculator.ts", `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
`);

    const result = parseProject(tmpDir);

    const addMethod = result.nodes.find((n) => n.symbolName === "Calculator.add");
    const subMethod = result.nodes.find((n) => n.symbolName === "Calculator.subtract");

    assert.ok(addMethod, "should extract class method 'Calculator.add'");
    assert.strictEqual(addMethod!.kind, "method");
    assert.strictEqual(addMethod!.id, "src/calculator.ts#Calculator.add");

    assert.ok(subMethod, "should extract class method 'Calculator.subtract'");
    assert.strictEqual(subMethod!.kind, "method");
  });

  test("node ID format is filePath#symbolName", () => {
    writeSource(tmpDir, "src/deep/nested/module.ts", `
export function deepFunc(): void {}
`);

    const result = parseProject(tmpDir);
    const node = result.nodes.find((n) => n.symbolName === "deepFunc");

    assert.ok(node, "should find the deeply nested function");
    assert.strictEqual(node!.id, "src/deep/nested/module.ts#deepFunc");
  });

  // -----------------------------------------------------------------------
  // Call edge detection
  // -----------------------------------------------------------------------

  test("detects call edges between functions", () => {
    writeSource(tmpDir, "src/caller.ts", `
function callee(): number {
  return 42;
}

function caller(): number {
  return callee();
}
`);

    const result = parseProject(tmpDir);

    const edge = result.edges.find(
      (e) =>
        e.callerId === "src/caller.ts#caller" &&
        e.calleeId === "src/caller.ts#callee",
    );

    assert.ok(edge, "should detect call edge from caller to callee");
  });

  // -----------------------------------------------------------------------
  // Dynamic call skipping
  // -----------------------------------------------------------------------

  test("skips dynamic calls (eval, element access)", () => {
    writeSource(tmpDir, "src/dynamic.ts", `
function target(): void {}

function useDynamic(): void {
  eval("target()");
  const obj: Record<string, () => void> = { target };
  obj["target"]();
}
`);

    const result = parseProject(tmpDir);

    // There should be no edges from useDynamic to target via eval or element access
    const evalEdge = result.edges.find(
      (e) =>
        e.callerId === "src/dynamic.ts#useDynamic" &&
        e.calleeId === "src/dynamic.ts#target",
    );

    // The direct call via eval("target()") is a string argument, not a call to target.
    // The element access obj["target"]() should be skipped.
    // There should be no edge from useDynamic to target.
    assert.strictEqual(evalEdge, undefined, "should skip dynamic calls");
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  test("returns empty result for workspace with no src/ files", () => {
    // tmpDir has an empty src/ directory
    const result = parseProject(tmpDir);
    assert.strictEqual(result.nodes.length, 0);
    assert.strictEqual(result.edges.length, 0);
  });
});
