import {MemberPageHeader} from './MemberPageHeader';
import {ErrorState,EmptyState,LoadingState} from '@ucell/design-system';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product, Qualification } from './api';
import { getProducts, isMock } from './memberData';
import { useResource } from './useResource';
import { demoProducts, demoTotal, useCommerce, validateShipping, type Shipping } from './commerce';
import ConnectedShop from './ConnectedShop';

const money = (n: number | null) => n === null ? '待確認' : `NT$ ${n.toLocaleString('zh-TW')}`;
export default function Shop({ q }: { q: Qualification }) {
  if(!isMock)return <ConnectedShop key={q.id} q={q}/>;
  const catalog = useResource('products', getProducts);
  const { carts, setQuantity, submit } = useCommerce();
  const cart = carts[q.id] ?? {};
  const [shipping, setShipping] = useState<Shipping>({ name: '', phone: '', address: '' });
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const key = useRef('');
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  function quantity(p: Product, n: number) {
    setQuantity(q.id, p.id, n); setReview(false); setReceipt(''); setError(''); key.current = '';
  }
  function preview() {
    const issue = validateShipping(shipping);
    if (issue) { setError(issue); return; }
    key.current = crypto.randomUUID(); setError(''); setReview(true);
  }
  function confirm() {
    try {
      const order = submit(q.id, shipping, key.current);
      setReceipt(order.id); setReview(false); setShipping({ name: '', phone: '', address: '' });
    } catch (e) { setError(e instanceof Error ? e.message : '請稍後重試'); }
  }
  return <><MemberPageHeader title="商品商城" q={q}/><p>{isMock ? '可體驗選購與訂單確認；示範訂單不扣款、不出貨、不產生 PV。請勿輸入真實個資。' : '線上購買尚未開放，價格與 PV 以訂單確認資料為準。'}</p>
    {catalog.error ? <section role="alert" className="card"><p>{catalog.error}</p><button onClick={catalog.retry}>重新載入商品</button></section>
      : !catalog.data ? <LoadingState label="商品載入中…"/>
      : catalog.data.length ? catalog.data.map(p => <article className="card" key={p.id}><div className="product-mark" aria-hidden="true">UCell</div><h3>{p.name}</h3><p>{money(p.price)} · PV {p.pv === null ? '待提供' : p.pv.toLocaleString('zh-TW')}</p>
        <button disabled={!isMock || !p.available || (cart[p.id] ?? 0) >= 99} onClick={() => quantity(p, (cart[p.id] ?? 0) + 1)}>{!isMock ? '購買功能準備中' : !p.available ? '暫無供貨' : '加入示範購物車'}</button></article>) : <p>目前沒有上架商品</p>}
    {isMock && <section className="card"><h3>購物車 · {q.code}</h3><p>共 {count} 件商品</p>
      {Object.entries(cart).map(([id, n]) => { const p = demoProducts.find(p => p.id === id)!; return <div className="cart-line" key={id}><strong>{p.name}</strong><div className="quantity"><button aria-label={`減少 ${p.name}`} onClick={() => quantity(p, n - 1)}>−</button><output aria-label={`${p.name} 數量`}>{n}</output><button disabled={n >= 99} aria-label={`增加 ${p.name}`} onClick={() => quantity(p, n + 1)}>＋</button><button onClick={() => quantity(p, 0)}>移除</button></div></div>; })}
      {!count ? <p>購物車尚無商品</p> : <><p>示範商品小計：<strong>{money(demoTotal(cart))}</strong></p><p className="muted">未含運費；正式應付金額與 PV 待訂單確認。</p>
        {!review ? <form onSubmit={e => { e.preventDefault(); preview(); }}><fieldset className="shipping"><legend>示範收件資料</legend>
          <label>收件人姓名<input autoComplete="off" maxLength={80} value={shipping.name} onChange={e => setShipping({ ...shipping, name: e.target.value })}/></label>
          <label>聯絡電話<input type="tel" autoComplete="off" maxLength={25} value={shipping.phone} onChange={e => setShipping({ ...shipping, phone: e.target.value })}/></label>
          <label>收件地址<textarea autoComplete="off" maxLength={300} value={shipping.address} onChange={e => setShipping({ ...shipping, address: e.target.value })}/></label>
          <button type="submit">檢查示範訂單</button></fieldset></form>
          : <section aria-label="訂單確認"><h3>確認示範訂單</h3><p>所屬資格：{q.code} · {q.ballLabel}</p><p>{shipping.name} · {shipping.phone}</p><p>{shipping.address}</p><p>示範商品小計：{money(demoTotal(cart))}</p><div className="tabs"><button onClick={() => setReview(false)}>返回修改</button><button onClick={confirm}>確認建立示範訂單</button></div></section>}</>}
      {error && <p role="alert">{error}</p>}
      {receipt && <section role="status"><h3>示範訂單已建立</h3><p>{receipt}</p><p>未扣款、未出貨，重新整理後清除。</p></section>}
    </section>}
    <Link className="text-link" to="/orders">查看我的訂單 →</Link></>;
}
