import { calculateTotal, calculateSubtotal, applyDiscount } from "../pricing";

describe("pricing", () => {
  test("calculateSubtotal sums items", () => {
    expect(calculateSubtotal([{ price: 1000, qty: 2 }])).toBe(2000);
  });

  test("applyDiscount reduces by percentage", () => {
    expect(applyDiscount(10000, 10)).toBe(9000);
  });

  test("calculateTotal computes full breakdown", () => {
    const result = calculateTotal([{ price: 1000, qty: 3 }], 0);
    expect(result.subtotal).toBe(3000);
    expect(result.tax).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(result.subtotal);
  });

  test("calculateTotal applies discount", () => {
    const result = calculateTotal([{ price: 5000, qty: 1 }], 20);
    expect(result.discount).toBe(1000);
  });
});
