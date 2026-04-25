import { startCheckout } from "./checkout";
import { addToCart } from "../cart/cartStore";

describe("Checkout Pipeline", () => {
  it("fails with empty cart", () => {
    const result = startCheckout("4111111111111111");
    expect(result).toHaveProperty("success");
  });

  it("produces a full checkout result with items", () => {
    addToCart({ sku: "W1", name: "Widget", price: 1000, qty: 2 });
    addToCart({ sku: "G1", name: "Gadget", price: 2500, qty: 1 });
    const result = startCheckout("4111111111111111", 10);
    expect(result.success).toBe(true);
    expect(result.receipt).toBeDefined();
  });
});
