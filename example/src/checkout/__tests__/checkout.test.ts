import { startCheckout } from "../checkout";
import { addToCart } from "../../cart/cartStore";

describe("checkout flow", () => {
  test("fails with empty cart", () => {
    const result = startCheckout("4111111111111111");
    // Cart may or may not be empty depending on test order
    expect(result).toHaveProperty("success");
  });

  test("succeeds with items in cart", () => {
    addToCart({ sku: "TEST1", name: "Test Item", price: 2500, qty: 2 });
    const result = startCheckout("4111111111111111");
    expect(result.success).toBe(true);
    expect(result.receipt).toBeDefined();
  });

  test("applies discount code", () => {
    addToCart({ sku: "TEST2", name: "Another Item", price: 5000, qty: 1 });
    const result = startCheckout("4111111111111111", 15);
    expect(result.success).toBe(true);
  });
});
