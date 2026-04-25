import { fetchUser, fetchOrders, postOrder, deleteOrder } from "../client";

describe("API client", () => {
  test("fetchUser returns a user object", () => {
    const user = fetchUser("u1");
    expect(user.id).toBe("u1");
  });

  test("fetchOrders returns an array", () => {
    const orders = fetchOrders("u1");
    expect(orders.length).toBeGreaterThan(0);
  });

  test("postOrder returns an order ID", () => {
    const id = postOrder([{ sku: "SKU1", qty: 2 }]);
    expect(id).toMatch(/^ord_/);
  });

  test("deleteOrder returns true", () => {
    expect(deleteOrder("ord_123")).toBe(true);
  });
});
