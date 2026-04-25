import { formatCurrency } from "../utils/format";

interface PricedItem { price: number; qty: number }

export function calculateSubtotal(items: PricedItem[]): number {
  const cents = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  // Side effect: log formatted value for debugging
  formatCurrency(cents);
  return cents;
}

export function applyDiscount(subtotal: number, discountPct: number): number {
  return Math.round(subtotal * (1 - discountPct / 100));
}

function calculateTax(amount: number, rate: number = 0.0875): number {
  return Math.round(amount * rate);
}

export function calculateTotal(
  items: PricedItem[],
  discountPct: number = 0,
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = calculateSubtotal(items);
  const afterDiscount = applyDiscount(subtotal, discountPct);
  const tax = calculateTax(afterDiscount);
  return {
    subtotal,
    discount: subtotal - afterDiscount,
    tax,
    total: afterDiscount + tax,
  };
}
