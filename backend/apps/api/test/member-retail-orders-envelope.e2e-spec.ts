import { firstValueFrom, from } from 'rxjs';
import { MemberController } from '../src/modules/member/member.controller';
import { EnvelopeInterceptor } from '../src/common/interceptors/envelope.interceptor';

describe('Member retail-order response envelope', () => {
  const personId = '51000000-0000-4000-8000-000000000001';
  function harness(rows: unknown[]) {
    const orders = { listWebRetailMember: jest.fn(async () => rows) };
    const controller = new MemberController({} as any, {} as any, {} as any, orders as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const req = { user: { personId }, requestId: 'retail-envelope-regression' };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as any;
    // Nest resolves only the top-level controller promise before interceptors.
    const response = () => firstValueFrom(new EnvelopeInterceptor().intercept(context, {
      handle: () => from(Promise.resolve(controller.retailOrders(req))),
    }));
    return { orders, response };
  }
  it.each([[], [{ orderNo: '202610010001', status: 'CONFIRMED', total: '1200', createdAt: '2026-10-01T00:00:00.000Z', confirmedAt: null, itemCount: 1, itemNames: ['Stage product'] }]])('serializes resolved history rather than a nested Promise', async (...rows: unknown[]) => {
    const test = harness(rows);
    const result = await test.response() as any;
    expect(JSON.parse(JSON.stringify(result)).data).toEqual(rows);
    expect(Array.isArray(result.data)).toBe(true);
    expect(test.orders.listWebRetailMember).toHaveBeenCalledWith(personId);
    expect(result.meta.api_version).toBe('v1');
  });
  it('propagates service failures instead of returning a successful empty object', async () => {
    const test = harness([]);
    test.orders.listWebRetailMember.mockRejectedValueOnce(new Error('read unavailable'));
    await expect(test.response()).rejects.toThrow('read unavailable');
  });
});
