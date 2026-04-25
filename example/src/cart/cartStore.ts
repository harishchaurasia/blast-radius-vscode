import { log } from "../utils/logger";

interface CartItem { sku: string; name: string; price: number; qty: number }

const items: CartItem[] = [];

export function addToCart(item: CartItem): void {
  const existing = items.find((i) => i.sku === item.sku);
  if (existing) {
    existing.qty += item.qty;
  } else {
    items.push({ ...item });
  }
  log("cart-add", { sku: item.sku, qty: item.qty });
}

export function removeFromCart(sku: string): void {
  const idx = items.findIndex((i) => i.sku === sku);
  if (idx !== -1) {
    items.splice(idx, 1);
    log("cart-remove", { sku });
  }
}

export function getCartItems(): CartItem[] {
  return [...items];
}
