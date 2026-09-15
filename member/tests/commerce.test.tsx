import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CommerceProvider, demoProducts, demoTotal, useCommerce, validateShipping } from '../src/commerce';
import Shop from '../src/Shop';
vi.mock('../src/memberData', async () => ({
  isMock: true,
  getProducts: async () => (await import('../src/commerce')).demoProducts,
}));
let tree: ReactTestRenderer;
let commerce: ReturnType<typeof useCommerce>;
const shipping = { name: '示範收件人', phone: '0900000000', address: '示範市示範路一號' };
const id = demoProducts[0].id;
function Probe() { commerce = useCommerce(); return null; }
async function mount(enabled = true) {
  await act(async () => { tree = create(<CommerceProvider enabled={enabled}><Probe /></CommerceProvider>); });
}
afterEach(() => { if (tree) act(() => tree.unmount()); vi.restoreAllMocks(); });
it('isolates carts and clears only the purchased qualification', async () => {
  await mount();
  act(() => { commerce.setQuantity('q1', id, 2); commerce.setQuantity('q2', id, 3); });
  act(() => { commerce.submit('q1', shipping, 'order-key'); });
  expect(commerce.carts.q1).toEqual({});
  expect(commerce.carts.q2[id]).toBe(3);
  expect(commerce.orders[0]).toMatchObject({ qualificationId: 'q1', total: 9600, items: { [id]: 2 } });
  expect(JSON.stringify(commerce.orders)).not.toContain(shipping.address);
  expect(JSON.stringify(commerce.orders)).not.toContain(shipping.phone);
});
it('returns one receipt for duplicate clicks before React rerenders', async () => {
  await mount();
  act(() => { commerce.setQuantity('q1', id, 1); });
  let first: unknown, second: unknown;
  act(() => { first = commerce.submit('q1', shipping, 'same'); second = commerce.submit('q1', shipping, 'same'); });
  expect(first).toBe(second);
  expect(commerce.orders).toHaveLength(1);
  expect(() => commerce.submit('q2', shipping, 'same')).toThrow('資格不符');
});
it('fails closed in real mode even if commerce methods are invoked directly', async () => {
  await mount(false);
  expect(() => commerce.setQuantity('q1', id, 1)).toThrow('尚未開放');
  expect(() => commerce.submit('q1', shipping, 'key')).toThrow('尚未開放');
  expect(commerce.orders).toEqual([]);
});
it.each([NaN, Infinity, -1, 1.5, 100])('rejects invalid quantity %s without mutating cart', async n => {
  await mount();
  expect(() => commerce.setQuantity('q1', id, n)).toThrow('無效');
  expect(commerce.carts).toEqual({});
});
it('rejects unknown products and empty carts', async () => {
  await mount();
  expect(() => commerce.setQuantity('q1', 'unknown', 1)).toThrow();
  expect(() => demoTotal({ unknown: 1 })).toThrow();
  expect(() => commerce.submit('q1', shipping, 'empty')).toThrow('尚無商品');
});
it('rejects invalid shipping without consuming the cart', async () => {
  await mount();
  act(() => commerce.setQuantity('q1', id, 1));
  expect(() => commerce.submit('q1', { ...shipping, name: ' ' }, 'invalid')).toThrow('姓名');
  expect(validateShipping({ ...shipping, phone: 'letters' })).toContain('電話');
  expect(validateShipping({ ...shipping, address: '短' })).toContain('地址');
  expect(commerce.carts.q1[id]).toBe(1);
});
it('allows a new order after a previous order and supports removal', async () => {
  await mount();
  act(() => { commerce.setQuantity('q1', id, 1); commerce.submit('q1', shipping, 'one'); });
  act(() => { commerce.setQuantity('q1', id, 2); commerce.setQuantity('q1', id, 0); });
  expect(commerce.carts.q1).toEqual({});
  act(() => { commerce.setQuantity('q1', id, 1); commerce.submit('q1', shipping, 'two'); });
  expect(commerce.orders).toHaveLength(2);
  expect(commerce.orders[0].id).not.toBe(commerce.orders[1].id);
});
it('completes the shop review flow and clears shipping after success', async () => {
  const q = { id: 'q1', code: 'Q1', rank: 'ELITE', active: true, ballLabel: '球1' };
  await act(async () => { tree = create(<MemoryRouter><CommerceProvider enabled><Shop q={q}/><Probe /></CommerceProvider></MemoryRouter>); });
  const button = (label: string) => tree.root.findAllByType('button').find(b => b.children.join('') === label)!;
  act(() => button('加入示範購物車').props.onClick());
  const inputs = tree.root.findAllByType('input');
  act(() => inputs[0].props.onChange({ target: { value: shipping.name } }));
  act(() => inputs[1].props.onChange({ target: { value: shipping.phone } }));
  act(() => tree.root.findByType('textarea').props.onChange({ target: { value: shipping.address } }));
  act(() => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  expect(JSON.stringify(tree.toJSON())).toContain('訂單確認');
  act(() => button('確認建立示範訂單').props.onClick());
  expect(JSON.stringify(tree.toJSON())).toContain('示範訂單已建立');
  expect(JSON.stringify(tree.toJSON())).not.toContain(shipping.address);
  expect(commerce.orders).toHaveLength(1);
});
