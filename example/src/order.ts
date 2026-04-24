// Example TypeScript file for testing the Blast Radius extension

export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

export function applyDiscount(total: number, discount: number): number {
  return total - (total * discount);
}

export function processOrder(items: number[], discount: number): number {
  const total = calculateTotal(items);
  return applyDiscount(total, discount);
}

export class OrderProcessor {
  processItems(items: number[]): number {
    return calculateTotal(items);
  }

  finalizeOrder(items: number[], discount: number): number {
    return processOrder(items, discount);
  }
}
