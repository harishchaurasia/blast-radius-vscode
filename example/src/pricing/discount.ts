// Discount engine

import { clamp, roundTo } from "../utils/math";

export type DiscountType = "percent" | "fixed" | "bogo";

export interface Discount {
  type: DiscountType;
  value: number;
}

export function applyPercentDiscount(subtotal: number, percent: number): number {
  const rate = clamp(percent, 0, 100) / 100;
  return roundTo(subtotal * (1 - rate), 2);
}

export function applyFixedDiscount(subtotal: number, amount: number): number {
  return roundTo(Math.max(subtotal - amount, 0), 2);
}

export function applyDiscount(subtotal: number, discount: Discount): number {
  switch (discount.type) {
    case "percent":
      return applyPercentDiscount(subtotal, discount.value);
    case "fixed":
      return applyFixedDiscount(subtotal, discount.value);
    case "bogo":
      return applyPercentDiscount(subtotal, 50);
    default:
      return subtotal;
  }
}
