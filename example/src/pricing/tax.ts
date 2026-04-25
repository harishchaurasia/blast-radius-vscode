// Tax calculation module

import { roundTo } from "../utils/math";

export interface TaxResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  rate: number;
}

export function calculateTax(subtotal: number, rate: number): TaxResult {
  const taxAmount = roundTo(subtotal * rate, 2);
  const total = roundTo(subtotal + taxAmount, 2);
  return { subtotal, taxAmount, total, rate };
}

export const applyTaxExemption = (result: TaxResult, exempt: boolean): TaxResult => {
  if (exempt) {
    return { ...result, taxAmount: 0, total: result.subtotal };
  }
  return result;
};
