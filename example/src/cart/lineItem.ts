// Line item model

import { formatCurrency } from "../utils/format";

export interface LineItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

export function lineItemTotal(item: LineItem): number {
  return item.unitPrice * item.quantity;
}

export function formatLineItemSummary(item: LineItem): string {
  const total = lineItemTotal(item);
  return `${item.name} x${item.quantity} = ${formatCurrency(total)}`;
}
