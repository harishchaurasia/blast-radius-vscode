// Shopping cart with class methods

import { LineItem, lineItemTotal } from "./lineItem";
import { applyDiscount, Discount } from "../pricing/discount";
import { calculateTax, applyTaxExemption, TaxResult } from "../pricing/tax";
import { sum } from "../utils/math";
import { formatCurrency } from "../utils/format";

export class ShoppingCart {
  private items: LineItem[] = [];
  private discount: Discount | null = null;
  private taxExempt: boolean = false;

  addItem(item: LineItem): void {
    this.items.push(item);
  }

  removeItem(name: string): void {
    this.items = this.items.filter(i => i.name !== name);
  }

  setDiscount(discount: Discount): void {
    this.discount = discount;
  }

  getSubtotal(): number {
    const totals = this.items.map(lineItemTotal);
    return sum(totals);
  }

  getTotal(): number {
    let subtotal = this.getSubtotal();
    if (this.discount) {
      subtotal = applyDiscount(subtotal, this.discount);
    }
    const taxResult = calculateTax(subtotal, 0.08);
    const finalTax = applyTaxExemption(taxResult, this.taxExempt);
    return finalTax.total;
  }

  getSummary(): string {
    const subtotal = this.getSubtotal();
    const total = this.getTotal();
    return `Subtotal: ${formatCurrency(subtotal)} | Total: ${formatCurrency(total)}`;
  }
}
