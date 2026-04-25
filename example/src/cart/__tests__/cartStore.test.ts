import { addToCart, removeFromCart, getCartItems } from "../cartStore";

describe("cart store", () => {
  test("addToCart adds an item", () => {
    addToCart({ sku: "A1", name: "Widget", price: 999, qty: 1 });
    expect(getCartItems().length).toBeGreaterThan(0);
  });

  test("removeFromCart removes an item", () => {
    addToCart({ sku: "B2", name: "Gadget", price: 1999, qty: 1 });
    removeFromCart("B2");
    expect(getCartItems().find((i) => i.sku === "B2")).toBeUndefined();
  });
});
