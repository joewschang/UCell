import {uiValue,uiText} from "../../shared/design-system/i18n";
import { Link, NavLink, useLocation } from 'react-router-dom';
import { MemberBottomNav, UCellIcon, type UCellIconName } from '@ucell/design-system';

export const memberSections: Array<{label:string;to:string;paths:string[];icon:UCellIconName}> = [
  { label: '首頁', to: '/', paths: ['/'], icon:'home' },
  { label: '探索', to: '/explore', paths: ['/explore','/content','/events','/learning'], icon:'content' },
  { label: '經營', to: '/business', paths: ['/business','/organization','/bonuses','/performance','/payouts','/sharing','/growth','/repurchase'], icon:'organization' },
  { label: '商城', to: '/shop', paths: ['/shop'], icon:'shop' },
  { label: '我的', to: '/me', paths: ['/me', '/orders', '/notifications', '/membership/upgrade'], icon:'me' },
];

export function sectionMatches(pathname: string, paths: string[]) {
  return paths.some(path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));
}

export function MemberNavigation({hasQualification=true}:{hasQualification?:boolean}) {
  const { pathname } = useLocation();
  return <MemberBottomNav>{[memberSections[0],memberSections[3],memberSections[1],...(hasQualification?[memberSections[2]]:[]),memberSections[4]].map(section => {
    const active = sectionMatches(pathname, section.paths);
    return <Link key={section.to} to={section.to} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}><UCellIcon name={section.icon}/><span>{uiValue((section.label))}</span></Link>;
  })}</MemberBottomNav>;
}

export function IncomeNavigation() {
  return <div className="uc-income-nav" role="navigation" aria-label="收益分類">
    <NavLink to="/bonuses">獎金明細</NavLink>
    <NavLink to="/payouts">付款紀錄</NavLink>
    <NavLink to="/performance">我的業績</NavLink>
  </div>;
}
