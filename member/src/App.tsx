import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useQualification } from './QualificationContext';
import * as data from './memberData';
import type { AwardStatus, Qualification } from './api';
import { useResource } from './useResource';
import Shop from './Shop';
import { CommerceProvider, useCommerce } from './commerce';
import Notifications from './Notifications';
import EndSession from './EndSession';
import Brand from './Brand';
import Icon, { type IconName } from './Icon';
import { NotificationProvider, useNotifications } from './NotificationContext';
export const number = (n: number | null) => n === null ? '待提供' : n.toLocaleString('zh-TW');
export const money = (n: number | null) => n === null ? '待確認' : `NT$ ${number(n)}`;
const statusNames: Record<AwardStatus, string> = { PENDING: '結算中', CALCULATED: '已計算', PENDING45D: '等待生效', EFFECTIVE: '已生效', PAYABLE: '可支付', PAID: '已支付', REVERSED: '已沖回', CLAWBACK: '追扣調整' };
function Result<T>({ state, children }: {
    state: {
        data?: T;
        error?: string;
        retry: () => void;
    };
    children: (value: T) => ReactNode;
}) {
    if (state.error)
        return <section className="card" role="alert"><p>{state.error}</p><button onClick={state.retry}>重新載入</button></section>;
    if (state.data === undefined)
        return <p role="status" className="loading">資料載入中…</p>;
    return <>{children(state.data)}</>;
}
function Metrics({ items }: {
    items: [
        string,
        number | null
    ][];
}) { return <section className="grid">{items.map(([label, value]) => <article key={label}><span>{label}</span><strong>{number(value)}</strong></article>)}</section>; }
function ContextBar() { const { qualifications, current, select } = useQualification(); return <section className="context"><label htmlFor="qualification">目前資格</label><select id="qualification" value={current?.id ?? ''} onChange={e => select(e.target.value)}>{qualifications.map(q => <option key={q.id} value={q.id}>{q.code}｜{data.displayRank(q.rank)}｜{q.ballLabel}</option>)}</select><small>{current?.active ? '資格活躍' : '資格未活躍'} · 組織、業績與獎金依此資格顯示</small></section>; }
function Home({ q }: {
    q: Qualification;
}) {
    const state = useResource(`dashboard:${q.id}`, s => data.getDashboard(q, s));
    const services: [string, string, IconName][] = [['/organization', '我的組織', 'organization'], ['/performance', '我的業績', 'chart'], ['/bonuses', '獎金明細', 'bonus'], ['/shop', '商品商城', 'shop'], ['/orders', '我的訂單', 'order'], ['/me', '會員資料', 'person']];
    return <Result state={state}>{d => <div className="home-layout">
      <section className="hero">
        <div className="hero-top"><span className="eyebrow">UCELL · MEMBER PRIVILEGES</span><span className="member-emblem" aria-hidden="true">U</span></div>
        <p className="hero-intro">美好日常，從照顧自己開始。</p>
        <h2>您好，{d.memberName}</h2>
        <div className="hero-bottom"><div><span className="eyebrow">MEMBER ID</span><p>{d.memberNo}</p></div><Link to="/me" aria-label="查看會員資料"><Icon name="arrow"/></Link></div>
      </section>
      <section className="card repurchase-card"><span className="service-icon"><Icon name={d.monthlyRepurchaseStatus === 'ACTIVE' ? 'check' : 'shop'}/></span><div><span>本月重購</span><h2>{{ ACTIVE: '已完成', PENDING: '確認中', INACTIVE: '未完成' }[d.monthlyRepurchaseStatus]}</h2></div><Link to="/shop">前往商城 <Icon name="arrow"/></Link></section>
      <section className="overview"><div className="section-heading"><div><span className="eyebrow">MY OVERVIEW</span><h3>我的會員概況</h3></div><Link to="/performance">查看業績 <Icon name="arrow"/></Link></div><Metrics items={[["PV", d.pv], ["RPV", d.rpv], ["EPV", d.epv]]}/><section className="card bonus-card"><div><span>本期獎金 · {statusNames[d.bonusStatus] ?? d.bonusStatus}</span><h2>{d.bonusAmount === null ? '結算中' : money(d.bonusAmount)}</h2><p>依目前資格顯示，以正式結算紀錄為準。</p></div><Link to="/bonuses" aria-label="查看獎金明細"><Icon name="arrow"/></Link></section></section>
      <section className="services"><div className="section-heading"><div><span className="eyebrow">AT YOUR SERVICE</span><h3>快速服務</h3></div><span className="section-note">每一步，都為您準備</span></div><div className="actions">{services.map(([path, title, icon]) => <Link key={path} to={path}><span className="service-icon"><Icon name={icon}/></span>{title}</Link>)}</div></section>
      <Link className="collection-link" to="/shop"><div><span className="eyebrow">UCELL COLLECTION</span><h3>為日常，留一份講究。</h3><p>探索商品與會員選購服務</p></div><Icon name="arrow"/></Link>
      <div className="brand-footer"><Brand/><span>宇生國際股份有限公司</span></div>
    </div>}</Result>;
}
function Organization({ q }: {
    q: Qualification;
}) {
    const [tab, setTab] = useState<'sponsor' | 'binary'>('sponsor');
    const sponsor = useResource(`sponsor:${q.id}`, s => data.getOrganization(q, s));
    const binary = useResource(`binary:${q.id}`, s => data.getBinary(q, s));
    return <><h2>我的組織</h2><div className="tabs"><button aria-pressed={tab === 'sponsor'} onClick={() => setTab('sponsor')}>推薦組織</button><button aria-pressed={tab === 'binary'} onClick={() => setTab('binary')}>二元組織</button></div>{tab === 'sponsor' ? <Result state={sponsor}>{d => <><section className="card"><h3>我的推薦人</h3><p>{d.sponsor ? `${d.sponsor.name} · ${d.sponsor.code}` : '尚無推薦人資料'}</p></section><section className="card"><h3>直推會員</h3>{d.referrals.length ? d.referrals.map(r => <p key={r.code}>{r.name} · {r.code}</p>) : <p>目前沒有直推會員</p>}</section></>}</Result> : <Result state={binary}>{d => <><p>左、右區為安置組織，與推薦關係分別呈現。</p><Metrics items={[["左區人數", d.left.count], ["右區人數", d.right.count], ["左區業績", d.left.volume], ["右區業績", d.right.volume]]}/></>}</Result>}</>;
}
function Period({ value, onChange }: {
    value: string;
    onChange: (p: string) => void;
}) { return <label className="period">查詢月份<input type="month" value={value} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
    onChange(e.target.value); }}/><small>月份為查詢條件；正式結算期間依系統紀錄。</small></label>; }
const initialMonth = () => new Date().toISOString().slice(0, 7);
function Performance({ q }: {
    q: Qualification;
}) {
    const [period, setPeriod] = useState(initialMonth);
    const state = useResource(`performance:${q.id}:${period}`, s => data.getPerformance(q, period, s));
    return <><h2>我的業績</h2><Period value={period} onChange={setPeriod}/><Result state={state}>{d => <><Metrics items={[["PV", d.pv], ["RPV", d.rpv], ["EPV", d.epv], ["左區業績", d.left], ["右區業績", d.right]]}/><p className="muted">資料更新：{d.asOf ?? '尚未提供'}</p></>}</Result></>;
}
function Bonuses({ q }: {
    q: Qualification;
}) {
    const [period, setPeriod] = useState(initialMonth);
    const awards = useResource(`bonuses:${q.id}:${period}`, s => data.getBonuses(q, period, s));
    const ledger = useResource(`ledger:${q.id}:${period}`, s => data.getLedger(q, period, s));
    return <><h2>獎金明細</h2><Period value={period} onChange={setPeriod}/><Result state={awards}>{d => d.awards.length ? d.awards.map(a => <article className="card row" key={a.id}><div><h3>{a.name}</h3><span>{statusNames[a.status] ?? a.status}</span></div><strong>{a.amount === null ? '結算中' : money(a.amount)}</strong></article>) : <p>此月份尚無獎金紀錄</p>}</Result><h3>入帳與調整紀錄</h3><Result state={ledger}>{d => d.entries.length ? d.entries.map(e => <article className="card" key={e.id}><h3>{e.label}</h3><strong>{money(e.amount)}</strong><p>{e.postedAt}</p><small>來源：{e.sourceId}</small></article>) : <p>此月份尚無入帳紀錄</p>}</Result></>;
}
function Orders({ q }: {
    q: Qualification;
}) { const { orders } = useCommerce(); const state = useResource(`orders:${q.id}`, s => data.getOrders(q, s)); const [expanded, setExpanded] = useState<string | null>(null); return <><h2>我的訂單</h2><Result state={state}>{d => { const visible = [...(data.isMock ? orders.filter(o => o.qualificationId === q.id) : []), ...d.orders]; return visible.length ? visible.map(o => <article className="card" key={o.id}><h3>{o.id}</h3><p>{o.createdAt} · {money(o.total)}</p><p>訂單：{o.status}</p><button aria-expanded={expanded === o.id} onClick={() => setExpanded(expanded === o.id ? null : o.id)}>付款與配送狀態</button>{expanded === o.id && <div><p>付款：{o.paymentStatus}</p><p>配送：{o.shipmentStatus}</p></div>}</article>) : <p>此資格目前沒有訂單</p>; }}</Result></>; }
function Me() { const state = useResource('person', data.getPerson); const { qualifications } = useQualification(); return <><h2>我的帳戶</h2><Result state={state}>{p => <section className="card"><h3>{p.name}</h3><p>{p.memberNo}</p><p>電子郵件：{p.email ?? '未提供'}</p><p>電話：{p.phone ?? '未提供'}</p></section>}</Result><h3>我的資格</h3>{qualifications.map(q => <article key={q.id} className="card"><strong>{q.code} · {q.ballLabel}</strong><p>{data.displayRank(q.rank)} · {q.active ? '活躍' : '未活躍'}</p></article>)}<EndSession /></>; }
function MemberApp() {
    const { pathname } = useLocation();
    const { loading, error, retry, current } = useQualification();
    const { unread } = useNotifications(current?.id);
    if (loading)
        return <main className="loading" role="status">資格資料載入中…</main>;
    if (error)
        return <main role="alert"><p>{error}</p><button onClick={retry}>重試</button></main>;
    return <div className={`app${pathname === '/' ? ' tech-home' : ''}`}><header><div><Brand/><small>MEMBER EXPERIENCE</small></div><span className="badge">{data.isMock ? '示範模式' : '會員服務'}</span>{current && <Link className="notification-link" to="/notifications" aria-label={data.isMock ? `通知中心，${unread} 則未讀` : '通知中心'}><Icon name="bell"/><span>通知{data.isMock ? ` ${unread}` : ''}</span></Link>}</header>{data.isMock && <aside className="demo-banner">目前為示範資料，不代表真實業績、獎金或訂單。</aside>}<main>{current ? <><ContextBar /><div key={current.id}><Routes><Route path="/" element={<Home q={current}/>}/><Route path="/organization" element={<Organization q={current}/>}/><Route path="/performance" element={<Performance q={current}/>}/><Route path="/bonuses" element={<Bonuses q={current}/>}/><Route path="/shop" element={<Shop q={current}/>}/><Route path="/orders" element={<Orders q={current}/>}/><Route path="/me" element={<Me />}/><Route path="/notifications" element={<Notifications q={current}/>}/><Route path="*" element={<section className="card"><h2>找不到頁面</h2><Link to="/">返回首頁</Link></section>}/></Routes></div></> : <section className="card"><h2>尚未取得會員資格</h2><p>請聯絡客服確認會員綁定與資格狀態。</p><button onClick={retry}>重新查詢</button></section>}</main><nav aria-label="主要功能"><NavLink end to="/"><Icon name="home"/><span>首頁</span></NavLink><NavLink to="/organization"><Icon name="organization"/><span>組織</span></NavLink><NavLink to="/shop"><Icon name="shop"/><span>商城</span></NavLink><NavLink to="/bonuses"><Icon name="bonus"/><span>獎金</span></NavLink><NavLink to="/me"><Icon name="person"/><span>我的</span></NavLink></nav></div>;
}

export default function App() { return <NotificationProvider enabled={data.isMock}><CommerceProvider enabled={data.isMock}><MemberApp /></CommerceProvider></NotificationProvider>; }
