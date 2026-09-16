import {MemberPageHeader} from './MemberPageHeader';
import {MemberAppShell,MemberBottomNav,QualificationSwitcher,MobileActionGrid,StatusBadge,MetricCard,MoneyState,LoadingState,ErrorState,QualificationBadge,AwardLifecycle,EmptyState} from '@ucell/design-system';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { useQualification } from './QualificationContext';
import * as data from './memberData';
import type { AwardStatus, Qualification } from './api';
import { useResource } from './useResource';
import Shop from './Shop';
import { CommerceProvider, useCommerce } from './commerce';
import Notifications from './Notifications';
import EndSession from './EndSession';
import ProfileEditor from './ProfileEditor';
import RepurchaseDetails from './RepurchaseDetails';
import {ConnectedOrderDetails} from './ConnectedShop';
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
        return <ErrorState message={state.error} retry={state.retry}/>;
    if (state.data === undefined)
        return <LoadingState/>;
    return <>{children(state.data)}</>;
}
function Metrics({ items }: {
    items: [
        string,
        number | null
    ][];
}) { return <section className="uc-metric-grid">{items.map(([label, value]) => <MetricCard key={label} label={label} value={number(value)}/>)}</section>; }
function ContextBar() { const {qualifications,current,select,feedback}=useQualification();return <QualificationSwitcher options={qualifications.map(q=>({id:q.id,label:q.code+'｜'+data.displayRank(q.rank)+'｜'+q.ballLabel}))} value={current?.id??''} onChange={select} feedback={feedback} active={current?.active??false}/>; }
function Home({ q }: {
    q: Qualification;
}) {
    const state = useResource(`dashboard:${q.id}`, s => data.getDashboard(q, s));
    return <Result state={state}>{d => <><section className="hero uc-member-identity"><small>會員中心</small><h2>您好，{d.memberName}</h2><p>{d.memberNo} · {q.code}｜{q.ballLabel}</p></section><section className="card uc-member-status"><div><span>資格狀態</span><strong>{q.active?'資格活躍':'資格未活躍'}</strong></div><div><span>本月重購</span><h2>{{ ACTIVE: '已完成', PENDING: '確認中', INACTIVE: '未完成' }[d.monthlyRepurchaseStatus]}</h2></div></section><h3 className="uc-eyebrow">業績摘要</h3><Metrics items={[["PV", d.pv], ["RPV", d.rpv], ["EPV", d.epv]]}/><section className="card uc-bonus-summary"><span>本期獎金 · {statusNames[d.bonusStatus] ?? d.bonusStatus}</span><h2><MoneyState amount={d.bonusAmount} status={d.bonusAmount===null?'PENDING':d.bonusStatus}/></h2></section><details className="uc-repurchase-expander"><summary>查看重購認列詳情</summary><RepurchaseDetails q={q}/></details><h3>快速服務</h3><MobileActionGrid>{[['/organization', '我的組織'], ['/performance', '我的業績'], ['/bonuses', '獎金明細'], ['/shop', '商品商城'], ['/orders', '我的訂單'], ['/me', '會員資料']].map(([path, title]) => <Link key={path} to={path}>{title}</Link>)}</MobileActionGrid></>}</Result>;
}
function Organization({ q }: {
    q: Qualification;
}) {
    const [tab, setTab] = useState<'sponsor' | 'binary'>('sponsor');
    const sponsor = useResource(`sponsor:${q.id}`, s => data.getOrganization(q, s));
    const binary = useResource(`binary:${q.id}`, s => data.getBinary(q, s));
    return <><div className="uc-member-title"><h2>我的組織</h2><QualificationBadge code={q.code} ball={q.ballLabel} rank={data.displayRank(q.rank)}/></div><div className="tabs"><button aria-pressed={tab === 'sponsor'} onClick={() => setTab('sponsor')}>推薦組織</button><button aria-pressed={tab === 'binary'} onClick={() => setTab('binary')}>二元組織</button></div>{tab === 'sponsor' ? <Result state={sponsor}>{d => <><section className="card"><h3>推薦摘要</h3><p className="uc-eyebrow">我的推薦人</p><p>{d.sponsor ? `${d.sponsor.name} · ${d.sponsor.code}` : '尚無推薦人資料'}</p></section><section className="card"><h3>直推會員</h3><p className="uc-system-note">本次 API 回傳 {d.referrals.length} 位直推會員</p>{d.referrals.length ? d.referrals.map(r => <p key={r.code}>{r.name} · {r.code}</p>) : <p>目前沒有直推會員</p>}</section></>}</Result> : <Result state={binary}>{d => <><p>左、右區為安置組織，與推薦關係分別呈現。</p><div className="uc-binary-summary">{[['左區',d.left],['右區',d.right]].map(([label,side])=><section className="card" key={String(label)}><h3>{String(label)}</h3><dl><dt>{String(label)}人數</dt><dd>{number((side as typeof d.left).count)}</dd><dt>{String(label)}業績</dt><dd>{number((side as typeof d.left).volume)}</dd><dt>Carry</dt><dd>待提供</dd></dl></section>)}</div><section className="card"><h3>Carry／完整組織</h3><p>待提供：目前 Member API 尚未提供 Carry 與完整 Tree Viewer 資料。</p></section></>}</Result>}</>;
}
function Period({ value, onChange }: {
    value: string;
    onChange: (p: string) => void;
}) { return <label className="period">查詢月份<input type="month" value={value} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
    onChange(e.target.value); }}/><small>月份為查詢條件；正式結算期間依系統紀錄。</small></label>; }
const initialMonth = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).format(new Date());
function Performance({ q }: {
    q: Qualification;
}) {
    const [period, setPeriod] = useState(initialMonth);
    const state = useResource(`performance:${q.id}:${period}`, s => data.getPerformance(q, period, s));
    return <><MemberPageHeader title="我的業績" q={q}/><Period value={period} onChange={setPeriod}/><Result state={state}>{d => <><Metrics items={[["PV", d.pv], ["RPV", d.rpv], ["EPV", d.epv], ["左區業績", d.left], ["右區業績", d.right]]}/><p className="muted">資料更新：{d.asOf ?? '尚未提供'}</p></>}</Result></>;
}
function Bonuses({ q }: {
    q: Qualification;
}) {
    const [period, setPeriod] = useState(initialMonth);
    const awards = useResource(`bonuses:${q.id}:${period}`, s => data.getBonuses(q, period, s));
    const ledger = useResource(`ledger:${q.id}:${period}`, s => data.getLedger(q, period, s));
    return <><div className="uc-member-title"><h2>獎金明細</h2><QualificationBadge code={q.code} ball={q.ballLabel} rank={data.displayRank(q.rank)}/></div><Period value={period} onChange={setPeriod}/><Result state={awards}>{d => d.awards.length ? d.awards.map(a => <article className="card" key={a.id}><div><h3>{a.name}</h3><p className="uc-award-status">{statusNames[a.status] ?? a.status}</p></div><MoneyState amount={a.amount} status={a.amount===null?'PENDING':a.status}/><AwardLifecycle status={a.status}/><details className="uc-domain-detail"><summary>查看制度明細</summary><p>Domain status：{a.status}</p><p>資格：{q.code}｜{q.ballLabel}</p><p>生效／可支付／支付時間：待 Backend 提供</p></details></article>) : <EmptyState title="此月份尚無獎金紀錄"/>}</Result><h3>入帳與調整紀錄</h3><Result state={ledger}>{d => d.entries.length ? d.entries.map(e => <article className="card" key={e.id}><h3>{e.label}</h3><strong>{money(e.amount)}</strong><p>{e.postedAt}</p><small>來源：{e.sourceId}</small></article>) : <EmptyState title="此月份尚無入帳紀錄"/>}</Result></>;
}
function Orders({ q }: {
    q: Qualification;
}) { const { orders } = useCommerce(); const state = useResource(`orders:${q.id}`, s => data.getOrders(q, s)); const [expanded, setExpanded] = useState<string | null>(null); return <><MemberPageHeader title="我的訂單" q={q}/><button disabled={state.data === undefined && !state.error} onClick={() => {setExpanded(null);state.retry();}}>重新整理訂單</button><Result state={state}>{d => { const visible = [...(data.isMock ? orders.filter(o => o.qualificationId === q.id) : []), ...d.orders]; return visible.length ? visible.map(o => <article className="card" key={o.id}><h3>{o.id}</h3><p>{o.createdAt} · {money(o.total)}</p><p>訂單：{o.status}</p><button aria-expanded={expanded === o.id} onClick={() => setExpanded(expanded === o.id ? null : o.id)}>付款與配送狀態</button>{expanded === o.id && <div><p>付款：{o.paymentStatus}</p><p>配送：{o.shipmentStatus}</p>{!data.isMock&&<ConnectedOrderDetails q={q} id={o.id}/>}</div>}</article>) : <EmptyState title="此資格目前沒有訂單"/>; }}</Result></>; }
function Me() { const state = useResource('person', data.getPerson); const { qualifications } = useQualification(); return <><MemberPageHeader title="我的帳戶"/><Result state={state}>{p => <section className="card"><h3>{p.name}</h3><p>{p.memberNo}</p><p>電子郵件：{p.email ?? '未提供'}</p><p>電話：{p.phone ?? '未提供'}</p></section>}</Result><ProfileEditor refresh={state.retry}/><h3>我的資格</h3>{qualifications.map(q => <article key={q.id} className="card"><strong>{q.code} · {q.ballLabel}</strong><p>{data.displayRank(q.rank)} · {q.active ? '活躍' : '未活躍'}</p></article>)}<EndSession connected={!data.isMock}/></>; }
function MemberApp() {
    const { loading, error, retry, current } = useQualification();
    const { unread } = useNotifications(current?.id);
    if (loading)
        return <main className="loading" role="status">資格資料載入中…</main>;
    if (error)
        return <main role="alert"><p>{error}</p><button onClick={retry}>重試</button></main>;
    return <MemberAppShell><header><div><b>UCell</b><small>會員服務</small></div>{current && <Link className="notification-link" to="/notifications" aria-label={data.isMock ? `通知中心，${unread} 則未讀` : '通知中心'}>通知{data.isMock ? ` ${unread}` : ''}</Link>}</header>{data.isMock && <aside className="demo-banner" data-environment="mock-visual-only"><strong>DEV 示範模式 · </strong><span>目前為示範資料，不代表真實業績、獎金或訂單。</span></aside>}<main>{current ? <><ContextBar /><div key={current.id}><Routes><Route path="/" element={<Home q={current}/>}/><Route path="/organization" element={<Organization q={current}/>}/><Route path="/performance" element={<Performance q={current}/>}/><Route path="/bonuses" element={<Bonuses q={current}/>}/><Route path="/shop" element={<Shop q={current}/>}/><Route path="/orders" element={<Orders q={current}/>}/><Route path="/me" element={<Me />}/><Route path="/notifications" element={<Notifications q={current}/>}/><Route path="*" element={<section className="card"><h2>找不到頁面</h2><Link to="/">返回首頁</Link></section>}/></Routes></div></> : <Routes><Route path="/me" element={<Me/>}/><Route path="*" element={<section className="card"><h2>尚未取得會員資格</h2><p>請聯絡客服確認會員綁定與資格狀態。</p><button onClick={retry}>重新查詢</button><Link className="text-link" to="/me">查看會員資料</Link><EndSession connected={!data.isMock}/></section>}/></Routes>}</main><MemberBottomNav><NavLink end to="/">首頁</NavLink><NavLink to="/organization">組織</NavLink><NavLink to="/shop">商城</NavLink><NavLink to="/bonuses">獎金</NavLink><NavLink to="/me">我的</NavLink></MemberBottomNav></MemberAppShell>;
}

export default function App() { return <NotificationProvider enabled={data.isMock}><CommerceProvider enabled={data.isMock}><MemberApp /></CommerceProvider></NotificationProvider>; }
