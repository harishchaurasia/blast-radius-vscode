import { fetchOrders } from "../api/client";
import { formatCurrency } from "../utils/format";

export class OrderList {
  renderOrders(userId: string): string[] {
    const orders = fetchOrders(userId);
    return orders.map((o) => `${o.orderId}: ${formatCurrency(o.total)}`);
  }
}
