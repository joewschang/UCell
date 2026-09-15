import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { Order, Product } from './api';

// Demo-only catalog. No values from this module may authorize real orders or PV.
export const demoProducts: Product[] = [
  { id: 'DEMO-TIP580', name: 'TIP-580（示範商品）', price: 4800, pv: 2880, available: true },
  { id: 'DEMO-TIP636', name: 'TIP-636（示範商品）', price: 4800, pv: 2880, available: true },
];
export type Cart = Record<string, number>;
export type Shipping = { name: string; phone: string; address: string };
export type DemoOrder = Order & { qualificationId: string; items: Cart };
export function validateShipping(s: Shipping): string | undefined {
  if (!s.name.trim() || s.name.trim().length > 80) return '請填寫收件人姓名（最多 80 字）';
  if (!/^\+?[0-9 ()-]{6,25}$/.test(s.phone.trim())) return '請填寫有效的聯絡電話';
  if (s.address.trim().length < 5 || s.address.trim().length > 300) return '請填寫完整收件地址（5–300 字）';
}
export function demoTotal(cart: Cart): number {
  if (!Object.keys(cart).length) throw Error('購物車尚無商品');
  return Object.entries(cart).reduce((sum, [id, quantity]) => {
    const product = demoProducts.find(p => p.id === id);
    if (!product?.available || product.price === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
      throw Error('商品或數量無效，請重新選購');
    return sum + product.price * quantity;
  }, 0);
}
type Store = { carts: Record<string, Cart>; orders: DemoOrder[] };
type Commerce = Store & {
  setQuantity: (q: string, id: string, quantity: number) => void;
  submit: (q: string, shipping: Shipping, key: string) => DemoOrder;
};
const Context = createContext<Commerce | null>(null);
export function CommerceProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [state, setState] = useState<Store>({ carts: {}, orders: [] });
  // Synchronous state enforces duplicate-submit protection before React rerenders.
  const current = useRef(state);
  const receipts = useRef(new Map<string, { q: string; order: DemoOrder }>());
  function publish(next: Store) { current.current = next; setState(next); }
  function assertDemo() { if (!enabled) throw Error('正式購買尚未開放'); }
  function setQuantity(q: string, id: string, quantity: number) {
    assertDemo();
    if (!q || !demoProducts.some(p => p.id === id && p.available) || !Number.isInteger(quantity) || quantity < 0 || quantity > 99)
      throw Error('商品或數量無效');
    const cart = { ...current.current.carts[q] };
    if (quantity === 0) delete cart[id]; else cart[id] = quantity;
    publish({ ...current.current, carts: { ...current.current.carts, [q]: cart } });
  }
  function submit(q: string, shipping: Shipping, key: string) {
    assertDemo();
    if (!q || !key.trim()) throw Error('訂單識別資料不足');
    const prior = receipts.current.get(key);
    if (prior) {
      if (prior.q !== q) throw Error('訂單資格不符');
      return prior.order;
    }
    const error = validateShipping(shipping);
    if (error) throw Error(error);
    const items = { ...current.current.carts[q] };
    const total = demoTotal(items);
    const order: DemoOrder = { id: `DEMO-${crypto.randomUUID()}`, qualificationId: q, items,
      createdAt: new Date().toISOString(), total, status: '示範訂單', paymentStatus: '示範：未扣款', shipmentStatus: '示範：不出貨' };
    // Do not retain names, phone numbers or addresses in demo receipts or storage.
    receipts.current.set(key, { q, order });
    publish({ carts: { ...current.current.carts, [q]: {} }, orders: [order, ...current.current.orders] });
    return order;
  }
  return <Context.Provider value={{ ...state, setQuantity, submit }}>{children}</Context.Provider>;
}
export function useCommerce() { const value = useContext(Context); if (!value) throw Error('Missing commerce context'); return value; }
