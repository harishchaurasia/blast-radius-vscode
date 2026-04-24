import { calculateTotal, processOrder, OrderProcessor } from './order';

describe('Order Processing', () => {
  test('calculateTotal sums items correctly', () => {
    expect(calculateTotal([10, 20, 30])).toBe(60);
  });

  test('processOrder applies discount', () => {
    expect(processOrder([100], 0.1)).toBe(90);
  });

  test('OrderProcessor processes items', () => {
    const processor = new OrderProcessor();
    expect(processor.processItems([5, 10, 15])).toBe(30);
  });
});
