import { getCartItems } from "../cart/cartStore";
import { calculateTotal } from "../cart/pricing";
import { processPayment } from "./payment";
import { generateReceipt } from "./receipt";
import { postOrder } from "../api/client";
import { log } from "../utils/logger";

function validateCart(): boolean {
  const items = getCartItems();
  return items.length > 0;
}

export function startCheckout(cardNumber: string, discountPct: number = 0): { success: boolean; receipt?: string } {
  log("checkout-start", {});

  if (!validateCart()) {
    return { success: false };
  }

  const items = getCartItems();
  const totals = calculateTotal(
    items.map((i) => ({ price: i.price, qty: i.qty })),
    discountPct,
  );

  const payment = processPayment(cardNumber, totals.total);
  if (!payment.success) {
    return { success: false };
  }

  postOrder(items.map((i) => ({ sku: i.sku, qty: i.qty })));

  const receipt = generateReceipt(
    items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
    totals.total,
    Date.now(),
  );

  log("checkout-complete", { transactionId: payment.transactionId });
  return { success: true, receipt };
}
