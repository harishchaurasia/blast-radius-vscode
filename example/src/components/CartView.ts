import { startCheckout } from "../checkout/checkout";
import { addToCart } from "../cart/cartStore";
import { calculateTotal } from "../cart/pricing";

export class CartView {
  private updateQuantity(sku: string, name: string, price: number, qty: number): void {
    addToCart({ sku, name, price, qty });
    // Recalculate to update the UI
    calculateTotal([{ price, qty }]);
  }

  checkout(cardNumber: string, discountPct: number = 0): { success: boolean; receipt?: string } {
    return startCheckout(cardNumber, discountPct);
  }
}
