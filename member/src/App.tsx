import {MemberPageHeader} from './MemberPageHeader';
import {MemberAppShell,MemberBottomNav,QualificationSwitcher,MobileActionGrid,MetricCard,MoneyState,LoadingState,ErrorState,EmptyState} from '@ucell/design-system';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQualification } from './QualificationContext';
import * as data from './memberData';
import type { Qualification } from './api';
import { useResource } from './useResource';
import Shop from './Shop';
import { CommerceProvider, useCommerce } from './commerce';
import Notifications from './Notifications';
import EndSession from './EndSession';
import ProfileEditor from './ProfileEditor';
import RepurchaseDetails from './RepurchaseDetails';
import {ConnectedOrderDetails} from './ConnectedShop';
import { NotificationProvider, useNotifications } from './NotificationContext';
import NetworkRegistration from './NetworkRegistration';
import ReferralShare from './ReferralShare';
import {ContentDetail,ContentList} from './Content';
import FormalUpgrade from './FormalUpgrade';
import QualificationPackageShop from './QualificationPackageShop';
import WebMemberRetailShop from './WebMemberRetailShop';
import MemberBinaryTree from './MemberBinaryTree';
import MemberTodaySummary from './MemberTodaySummary';
import MemberAwardJourney from './MemberAwardJourney';
import {availabilityText,awardStatusLabels,formatNullableMoney,formatNullableNumber,qualificationActiveLabel} from './terminology';
export const number = formatNullableNumber;
export const money = formatNullableMoney;
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
function ContextBar() { const {qualifications,current,select,feedback}=useQualification();return <QualificationSwitcher options={qualifications.map(q=>({id:q.id,label:`球編號 ${q.code}｜方案 ${data.displayPlanLevel(q.rank)}`}))} value={current?.id??''} onChange={select} feedback={feedback} active={current?.active??false}/>; }
function Home({ q }: {
    q: Qualification;
}) {
    const state = useResource(`dashboard:${q.id}`, s => data.getDashboard(q, s));
    const [repurchaseDetailsOpen,setRepurchaseDetailsOpen] = useState(false);
    return <Result state={state}>{d => <div className="uc-dashboard">
        <section className="hero uc-member-identity" aria-labelledby="member-today-title">
            <div className="uc-orbit" aria-hidden="true"/>
            <div className="uc-identity-copy"><small>MY UCELL TODAY</small><h1 id="member-today-title">您好，{d.memberName}</h1><p><span>會員編號</span> {d.memberNo}</p></div>
            <div className="uc-identity-badge"><span>球編號</span><strong>{q.code}</strong><small>方案 {data.displayPlanLevel(q.rank)}</small></div>
        </section>
        <section className="card uc-member-status"><div className="uc-status-block"><span>目前經營資格</span><strong>{qualificationActiveLabel(q.active)}</strong><small>{d.monthReference??'月份尚未提供'} · {d.activeInterval?`${d.activeInterval.activeFrom} ～ ${d.activeInterval.activeTo}`:'Active 區間尚未提供'}</small></div><div className="uc-status-block"><span>本月重購狀態</span><strong>{{ ACTIVE: '已完成', PENDING: '確認中', INACTIVE: '未完成' }[d.monthlyRepurchaseStatus]}</strong><i className="uc-status-signal" data-state={d.monthlyRepurchaseStatus} aria-hidden="true"/></div></section>
        <div className="uc-section-heading"><div><small>LIVE READ MODEL</small><h2>業績摘要</h2></div><span>{d.monthReference??'當期資料'}</span></div>
        <Metrics items={[["PV", d.pv], ["RPV", d.rpv], ["EPV", d.epv]]}/>
        <MemberTodaySummary q={q} monthlyRepurchaseStatus={d.monthlyRepurchaseStatus} repurchaseDetailsOpen={repurchaseDetailsOpen} onShowRepurchaseDetails={()=>setRepurchaseDetailsOpen(true)}/>
        <section className="card uc-bonus-summary"><div><span>本期獎金</span><small>{awardStatusLabels[d.bonusStatus]}</small></div><h2><MoneyState amount={d.bonusAmount} status={d.bonusAmount===null?'PENDING':d.bonusStatus}/></h2><Link to="/bonuses">查看結算明細</Link></section>
        <details id="repurchase-details" className="uc-repurchase-expander" open={repurchaseDetailsOpen} onToggle={event=>setRepurchaseDetailsOpen(event.currentTarget.open)}><summary>查看重購認列詳情</summary><RepurchaseDetails q={q}/></details>
        <div className="uc-section-heading"><div><small>MEMBER SERVICES</small><h2>快速服務</h2></div></div>
        <MobileActionGrid>{[['/organization', '我的組織'], ['/performance', '我的業績'], ['/bonuses', '獎金明細'], ['/shop', '商品商城'], ['/orders', '我的訂單'], ['/content', '影音內容'], ['/me', '會員資料']].map(([path, title],index) => <Link key={path} to={path}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{title}</Link>)}</MobileActionGrid>
    </div>}</Result>;
}
function Organization({ q }: {
    q: Qualification;
}) {
    const [tab, setTab] = useState<'sponsor' | 'binary'>('sponsor');
    const sponsor = useResource(`sponsor:${q.id}`, s => data.getOrganization(q, s));
    const binary = useResource(`binary:${q.id}`, s => data.getBinary(q, s));
    const tabs: Array<'sponsor' | 'binary'> = ['sponsor', 'binary'];
    const moveTab = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
            return;
        event.preventDefault();
        const currentIndex = tabs.indexOf(tab);
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        const next = tabs[nextIndex];
        setTab(next);
        requestAnimationFrame(() => document.getElementById(`org-${next}-tab`)?.focus());
    };
    return <div className="uc-organization">
        <MemberPageHeader title="我的組織" q={q}/>
        <p className="uc-page-intro">推薦組織與二元安置組織使用不同關係與資料範圍，請分開查看。</p>
        <div className="tabs uc-segmented" role="tablist" aria-label="組織檢視" onKeyDown={moveTab}>
            <button type="button" id="org-sponsor-tab" role="tab" aria-selected={tab === 'sponsor'} aria-controls="org-sponsor-panel" tabIndex={tab === 'sponsor' ? 0 : -1} onClick={() => setTab('sponsor')}>推薦組織</button>
            <button type="button" id="org-binary-tab" role="tab" aria-selected={tab === 'binary'} aria-controls="org-binary-panel" tabIndex={tab === 'binary' ? 0 : -1} onClick={() => setTab('binary')}>二元組織</button>
        </div>
        {tab === 'sponsor' ? <section id="org-sponsor-panel" role="tabpanel" aria-labelledby="org-sponsor-tab"><Result state={sponsor}>{d => <>
            <div className="uc-network-panel">
                <section className="card uc-sponsor-card"><small>UPLINE NODE</small><h3>我的推薦人</h3><div className="uc-person-node"><i aria-hidden="true"/><div><strong>{d.sponsor?.name || d.sponsor?.code || '目前沒有推薦人資料'}</strong>{d.sponsor && <span>球編號 {d.sponsor.code}</span>}</div></div></section>
                <section className="card uc-referral-card"><div className="uc-card-heading"><div><small>DIRECT NETWORK</small><h3>直推會員</h3></div><strong>{d.referrals.length}</strong></div><p className="uc-system-note">本次 API 回傳 {d.referrals.length} 位直推會員</p>{d.referrals.length ? <div className="uc-node-list">{d.referrals.map((r, index) => <div className="uc-person-node" key={r.code}><i aria-hidden="true"/><div><strong>{r.name || r.code}</strong><span>球編號 {r.code}</span></div><small>{String(index + 1).padStart(2, '0')}</small></div>)}</div> : <p>目前沒有直推會員</p>}</section>
            </div>
            <ReferralShare q={q}/>
        </>}</Result></section> : <section id="org-binary-panel" role="tabpanel" aria-labelledby="org-binary-tab"><Result state={binary}>{d => <>
            <div className="uc-network-note"><span aria-hidden="true"/><p>左、右區屬二元安置組織，與推薦組織分別呈現。業績與 Carry 只有在權威結算資料可用時才會顯示。</p></div>
            <div className="uc-binary-summary">{[['左區', d.left], ['右區', d.right]].map(([label, side], index) => <section className="card uc-binary-card" data-side={index === 0 ? 'left' : 'right'} key={String(label)}><div className="uc-card-heading"><div><small>{index === 0 ? 'LEFT NETWORK' : 'RIGHT NETWORK'}</small><h3>{String(label)}</h3></div><span className="uc-node-pulse" aria-hidden="true"/></div><dl><div><dt>{String(label)}球數</dt><dd>{number((side as typeof d.left).count)}</dd></div><div><dt>{String(label)}業績</dt><dd>{d.settlementMetrics.status === 'AVAILABLE' ? number((side as typeof d.left).volume) : availabilityText.readModelMissing}</dd></div><div><dt>Carry</dt><dd>{d.settlementMetrics.status === 'AVAILABLE' ? number((side as typeof d.left).carry) : availabilityText.readModelMissing}</dd></div></dl></section>)}</div>
            <MemberBinaryTree key={q.id} q={q}/>
        </>}</Result></section>}
    </div>;
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
    return <div className="uc-bonuses"><MemberPageHeader title="獎金明細" q={q}/><p className="uc-page-intro">每筆紀錄都屬於目前球編號；金額、結算與撥付只顯示伺服器已提供的結果。</p><Period value={period} onChange={setPeriod}/><Result state={awards}>{d => d.awards.length ? <section className="uc-award-list" aria-label="獎金項目">{d.awards.map(a => <MemberAwardJourney key={a.id} award={a} q={q} period={period}/>)}</section> : <EmptyState title="此月份尚無獎金紀錄"><p>尚無資料不等同金額為零。</p></EmptyState>}</Result><div className="uc-section-heading"><div><small>ACCOUNT LEDGER</small><h3>入帳與調整紀錄</h3></div></div><Result state={ledger}>{d => d.entries.length ? <section className="uc-ledger-list" aria-label="入帳與調整紀錄">{d.entries.map(e => <article className="card uc-ledger-card" key={e.id}><div><small>{e.postedAt}</small><h3>{e.label}</h3><span>系統已記錄此筆入帳來源</span></div><strong>{money(e.amount)}</strong></article>)}</section> : <EmptyState title="此月份尚無入帳紀錄"><p>尚無資料不等同沒有後續結算或調整。</p></EmptyState>}</Result></div>;
}
function Orders({ q }: {
    q: Qualification;
}) { const { orders } = useCommerce(); const state = useResource(`orders:${q.id}`, s => data.getOrders(q, s)); const [expanded, setExpanded] = useState<string | null>(null); return <><MemberPageHeader title="我的訂單" q={q}/><button disabled={state.data === undefined && !state.error} onClick={() => {setExpanded(null);state.retry();}}>重新整理訂單</button><Result state={state}>{d => { const visible = [...(data.isMock ? orders.filter(o => o.qualificationId === q.id) : []), ...d.orders]; return visible.length ? visible.map(o => <article className="card" key={o.id}><h3>訂單紀錄</h3><p>{o.createdAt} · {money(o.total)}</p><p>訂單：{o.status}</p><button aria-expanded={expanded === o.id} onClick={() => setExpanded(expanded === o.id ? null : o.id)}>付款與配送狀態</button>{expanded === o.id && <div><p>付款：{o.paymentStatus}</p><p>配送：{o.shipmentStatus}</p>{!data.isMock&&<ConnectedOrderDetails q={q} id={o.id}/>}</div>}</article>) : <EmptyState title="此資格目前沒有訂單"/>; }}</Result></>; }
function Me() {
 const state = useResource('person', data.getPerson);
 const { qualifications } = useQualification();
 return <>
  <MemberPageHeader title="我的帳戶"/>
  <Result state={state}>{p => <>
   <section className="card"><h3>{p.name}</h3><p><span>會員編號</span> {p.memberNo}</p><p>會員狀態：{p.membershipState??'尚未完成網路會員註冊'}</p><p>電子郵件：{p.email ?? availabilityText.fieldMissing}</p><p>電話：{p.phone ?? availabilityText.fieldMissing}</p></section>
   {!data.isMock&&p.membershipState===null&&<NetworkRegistration person={p} refresh={state.retry}/>}
   {!data.isMock&&['NETWORK_MEMBER','FORMAL_PENDING'].includes(p.membershipState??'')&&<FormalUpgrade/>}
  </>}</Result>
  <ProfileEditor refresh={state.retry}/>
  <h3>我的經營資格</h3>
  {qualifications.map(q => <article key={q.id} className="card"><strong>球編號 {q.code}</strong><p>方案：{data.displayPlanLevel(q.rank)} · {qualificationActiveLabel(q.active)}</p></article>)}
  <EndSession connected={!data.isMock}/>
 </>;
}
function MemberApp() {
    const { loading, error, retry, current, memberNo, memberNoStatus } = useQualification();
    const { unread } = useNotifications(current?.id);
    const memberIdentityLabel=memberNo?`會員編號 ${memberNo}`:memberNoStatus==='loading'?'會員編號確認中':'會員編號尚未提供（帳戶資料尚未同步）';
    if (loading)
        return <main className="loading"><LoadingState label="正在確認目前球與會員資格…"/></main>;
    if (error)
        return <main className="loading"><ErrorState message={error} retry={retry}/></main>;
    return <MemberAppShell>
      <header><div><b>UCell</b><small>{memberIdentityLabel}</small></div>{current && <Link className="notification-link" to="/notifications" aria-label={data.isMock ? `通知中心，${unread} 則未讀` : '通知中心'}>通知{data.isMock ? ` ${unread}` : ''}</Link>}</header>
      {data.isMock && <aside className="demo-banner" data-environment="mock-visual-only"><strong>DEV 示範模式 · </strong><span>目前為示範資料，不代表真實業績、獎金或訂單。</span></aside>}
      <main>{current ? <><ContextBar /><div key={current.id}><Routes>
        <Route path="/" element={<Home q={current}/>}/>
        <Route path="/organization" element={<Organization q={current}/>}/>
        <Route path="/performance" element={<Performance q={current}/>}/>
        <Route path="/bonuses" element={<Bonuses q={current}/>}/>
        <Route path="/shop" element={<Shop q={current}/>}/>
        <Route path="/orders" element={<Orders q={current}/>}/>
        <Route path="/content" element={<ContentList q={current}/>}/>
        <Route path="/content/:id" element={<ContentDetail q={current}/>}/>
        <Route path="/me" element={<Me />}/>
        <Route path="/notifications" element={<Notifications q={current}/>}/>
        <Route path="*" element={<section className="card"><h2>找不到頁面</h2><Link to="/">返回首頁</Link></section>}/>
      </Routes></div></> : <Routes>
        <Route path="/shop" element={<><WebMemberRetailShop/><QualificationPackageShop onCreated={retry}/></>}/>
        <Route path="/me" element={<Me/>}/>
        <Route path="*" element={<section className="card"><h2>尚未取得會員資格</h2><p>可先完成正式會員資料，再透過正式套組取得第一個會員資格。</p><Link className="text-link" to="/shop">選擇正式會員套組</Link><button onClick={retry}>重新查詢</button><Link className="text-link" to="/me">查看會員資料</Link><EndSession connected={!data.isMock}/></section>}/>
      </Routes>}</main>
      <MemberBottomNav><NavLink end to="/">首頁</NavLink><NavLink to="/organization">組織</NavLink><NavLink to="/shop">商城</NavLink><NavLink to="/bonuses">收益</NavLink><NavLink to="/me">我的</NavLink></MemberBottomNav>
    </MemberAppShell>;
}

export default function App() { return <NotificationProvider enabled={data.isMock}><CommerceProvider enabled={data.isMock}><MemberApp /></CommerceProvider></NotificationProvider>; }
