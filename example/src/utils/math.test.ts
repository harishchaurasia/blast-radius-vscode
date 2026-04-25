import { clamp, roundTo, sum, average } from "./math";

describe("Math Utilities", () => {
  it("clamps values within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("rounds to specified decimals", () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
  });

  it("sums an array", () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it("averages an array", () => {
    expect(average([10, 20, 30])).toBe(20);
  });

  it("average of empty array is 0", () => {
    expect(average([])).toBe(0);
  });
});
