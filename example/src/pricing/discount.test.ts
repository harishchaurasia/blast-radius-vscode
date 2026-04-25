import { applyPercentDiscount, applyFixedDiscount, applyDiscount } from "./discount";

describe("Discount Engine", () => {
  it("applies percent discount", () => {
    expect(applyPercentDiscount(100, 20)).toBe(80);
  });

  it("applies fixed discount", () => {
    expect(applyFixedDiscount(100, 30)).toBe(70);
  });

  it("routes through applyDiscount", () => {
    expect(applyDiscount(200, { type: "fixed", value: 50 })).toBe(150);
  });

  it("clamps percent to 0-100", () => {
    expect(applyPercentDiscount(100, 150)).toBe(0);
  });
});
