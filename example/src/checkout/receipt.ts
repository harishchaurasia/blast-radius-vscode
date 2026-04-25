import { formatCurrency, formatDate } from "../utils/format";

interface LineItem { name: string; qty: number; price: number }

function formatLineItems(items: LineItem[]): string[] {
  return items.map((i) => `${i.qty}x ${i.name} — ${formatCurrency(i.price * i.qty)}`);
}

export function generateReceipt(
  items: LineItem[],
  totalCents: number,
  timestamp: number,
): string {
  const lines = formatLineItems(items);
  const total = formatCurrency(totalCents);
  const date = formatDate(timestamp);
  return [
    `Receipt — ${date}`,
    "─".repeat(30),
    ...lines,
    "─".repeat(30),
    `Total: ${total}`,
  ].join("\n");
}
