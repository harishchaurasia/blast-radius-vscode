import { ShoppingCart } from "./cart";
import { lineItemTotal } from "./lineItem";

describe("ShoppingCart", () => {
  it("calculates subtotal from line items", () => {
    const cart = new ShoppingCart();
    cart.addItem({ name: "Widget", unitPrice: 10, quantity: 3 });
    cart.addItem({ name: "Gadget", unitPrice: 25, quantity: 1 });
    expect(cart.getSubtotal()).toBe(55);
  });

  it("applies discount to total", () => {
    const cart = new ShoppingCart();
    cart.addItem({ name: "Widget", unitPrice: 100, quantity: 1 });
    cart.setDiscount({ type: "percent", value: 10 });
    expect(cart.getTotal()).toBeLessThan(100);
  });
});

describe("lineItemTotal", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineItemTotal({ name: "X", unitPrice: 5, quantity: 4 })).toBe(20);
  });
});
