import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { parseProject } from "../../parser/codeParser";
import { buildGraph } from "../../graph/graphBuilder";
import { buildTestMap } from "../../parser/testMapper";
import { computeBlastRadius } from "../../analysis/impactEngine";

/**
 * Integration tests for the full pipeline:
 *   parseProject -> buildGraph -> buildTestMap -> computeBlastRadius
 *
 * Creates a small fixture project on disk and runs the entire pipeline
 * end-to-end, verifying blast radius results.
 */
suite("Integration: Full Pipeline", () => {
  let tmpDir: string;

  function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-radius-int-"));

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

    // Create a small fixture project:
    //
    //   src/cart/pricing.ts    - calculateTotal() calls applyDiscount()
    //   src/cart/discount.ts   - applyDiscount() calls validateCoupon()
    //   src/utils/validate.ts  - validateCoupon() (leaf)
    //   src/cart/pricing.test.ts - imports calculateTotal

    writeFile(tmpDir, "src/utils/validate.ts", `
export function validateCoupon(code: string): boolean {
  return code.length > 0;
}
`);

    writeFile(tmpDir, "src/cart/discount.ts", `
import { validateCoupon } from "../utils/validate.js";

export function applyDiscount(price: number, coupon: string): number {
  if (validateCoupon(coupon)) {
    return price * 0.9;
  }
  return price;
}
`);

    writeFile(tmpDir, "src/cart/pricing.ts", `
import { applyDiscount } from "./discount.js";

export function calculateTotal(items: number[], coupon: string): number {
  const subtotal = items.reduce((sum, item) => sum + item, 0);
  return applyDiscount(subtotal, coupon);
}
`);

    writeFile(tmpDir, "src/cart/pricing.test.ts", `
import { calculateTotal } from "./pricing.js";

const total = calculateTotal([10, 20], "SAVE10");
`);
  });

  teardown(() => {
    rmrf(tmpDir);
  });

  // -----------------------------------------------------------------------
  // End-to-end pipeline
  // -----------------------------------------------------------------------

  test("end-to-end: parse -> graph -> test map -> blast radius", () => {
    // Step 1: Parse
    const parseResult = parseProject(tmpDir);
    assert.ok(parseResult.nodes.length >= 3, "should parse at least 3 functions");

    // Step 2: Build graph
    const graph = buildGraph(parseResult);
    assert.ok(graph.nodes.size >= 3, "graph should have at least 3 nodes");

    // Step 3: Build test map
    const testMap = buildTestMap(tmpDir, graph);

    // Step 4: Compute blast radius for calculateTotal
    const result = computeBlastRadius(
      "src/cart/pricing.ts#calculateTotal",
      graph,
      testMap,
    );

    assert.strictEqual(result.selectedNodeId, "src/cart/pricing.ts#calculateTotal");

    // Downstream: calculateTotal -> applyDiscount -> validateCoupon
    assert.ok(
      result.downstream.has("src/cart/discount.ts#applyDiscount"),
      "downstream should include applyDiscount",
    );
    assert.ok(
      result.downstream.has("src/utils/validate.ts#validateCoupon"),
      "downstream should include validateCoupon (transitive)",
    );
  });

  test("blast radius includes expected upstream nodes", () => {
    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    // Compute blast radius for applyDiscount (middle of chain)
    const result = computeBlastRadius(
      "src/cart/discount.ts#applyDiscount",
      graph,
      testMap,
    );

    // Upstream: calculateTotal calls applyDiscount
    assert.ok(
      result.upstream.has("src/cart/pricing.ts#calculateTotal"),
      "upstream should include calculateTotal",
    );

    // Downstream: applyDiscount calls validateCoupon
    assert.ok(
      result.downstream.has("src/utils/validate.ts#validateCoupon"),
      "downstream should include validateCoupon",
    );
  });

  test("blast radius includes linked test files", () => {
    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    // calculateTotal is imported by pricing.test.ts
    const result = computeBlastRadius(
      "src/cart/pricing.ts#calculateTotal",
      graph,
      testMap,
    );

    assert.ok(
      result.linkedTests.some((t) => t.includes("pricing.test.ts")),
      "should link to pricing.test.ts",
    );
  });

  test("feature module inference from fixture file paths", () => {
    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    const result = computeBlastRadius(
      "src/cart/pricing.ts#calculateTotal",
      graph,
      testMap,
    );

    // Downstream includes nodes in cart/ and utils/
    assert.ok(
      result.affectedModules.includes("cart") || result.affectedModules.includes("utils"),
      "should infer feature modules from affected node paths",
    );
  });

  test("leaf node has no downstream", () => {
    const parseResult = parseProject(tmpDir);
    const graph = buildGraph(parseResult);
    const testMap = buildTestMap(tmpDir, graph);

    const result = computeBlastRadius(
      "src/utils/validate.ts#validateCoupon",
      graph,
      testMap,
    );

    assert.strictEqual(result.downstream.size, 0, "leaf node should have no downstream");
    assert.ok(result.upstream.size > 0, "leaf node should have upstream callers");
  });
});
