import { withAuth, rateLimiter, buildHeaders } from "./middleware";
import { setUser } from "../store/userStore";
import { log } from "../utils/logger";

export function fetchUser(userId: string): { id: string; name: string } {
  withAuth();
  rateLimiter();
  const user = { id: userId, name: `User ${userId}` };
  setUser(user);
  return user;
}

export function fetchOrders(userId: string): { orderId: string; total: number }[] {
  withAuth();
  rateLimiter();
  return [
    { orderId: "ord_1", total: 4999 },
    { orderId: "ord_2", total: 12950 },
  ];
}

export function postOrder(items: { sku: string; qty: number }[]): string {
  withAuth();
  buildHeaders();
  log("order-placed", { itemCount: items.length });
  return `ord_${Date.now()}`;
}

export function deleteOrder(orderId: string): boolean {
  withAuth();
  log("order-deleted", { orderId });
  return true;
}
