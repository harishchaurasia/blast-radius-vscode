import { fetchUser, fetchOrders } from "../api/client";
import { formatCurrency, formatDate } from "../utils/format";

export class Dashboard {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private renderStats(orders: { orderId: string; total: number }[]): string {
    const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
    return `${orders.length} orders — ${formatCurrency(totalRevenue)} — as of ${formatDate(Date.now())}`;
  }

  loadDashboard(): { user: { id: string; name: string }; stats: string } {
    const user = fetchUser(this.userId);
    const orders = fetchOrders(this.userId);
    const stats = this.renderStats(orders);
    return { user, stats };
  }
}
