import { log, logError } from "../utils/logger";

function validateCard(cardNumber: string): boolean {
  // Luhn-lite: just check length and prefix
  return cardNumber.length === 16 && cardNumber.startsWith("4");
}

function chargeCard(cardNumber: string, amountCents: number): boolean {
  try {
    // Simulate charge
    if (amountCents <= 0) { throw new Error("Invalid amount"); }
    return true;
  } catch (err) {
    logError("charge-failed", err);
    return false;
  }
}

export function processPayment(cardNumber: string, amountCents: number): { success: boolean; transactionId?: string } {
  log("payment-start", { amountCents });
  if (!validateCard(cardNumber)) {
    return { success: false };
  }
  const charged = chargeCard(cardNumber, amountCents);
  if (!charged) {
    return { success: false };
  }
  return { success: true, transactionId: `txn_${Date.now()}` };
}
