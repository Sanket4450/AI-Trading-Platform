import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

describe('R2 no-order guarantee', () => {
  it('does not import an order, position or trading module into the API', () => {
    const appModule = source('../../apps/api/src/app.module.ts');
    for (const moduleName of ['OrdersModule', 'PositionsModule', 'TradingModule', 'RiskModule']) {
      expect(appModule).not.toContain(moduleName);
    }
  });

  it('keeps the Upstox adapter read-only', () => {
    const client = source('../../packages/adapters/upstox/client.ts');
    for (const method of ['placeOrder', 'modifyOrder', 'cancelOrder', 'createOrder']) {
      expect(client).not.toContain(method);
    }
  });

  it('leaves the placeholder order controllers without routes', () => {
    const orders = source('../../apps/api/src/modules/orders/orders.controller.ts');
    expect(orders).not.toMatch(/@(Get|Post|Put|Patch|Delete)\(/);
  });
});
