import { Link, NavLink, useLocation } from 'react-router-dom';
import { MemberBottomNav } from '@ucell/design-system';

export const memberSections = [
  { label: '首頁', to: '/', paths: ['/'] },
  { label: '組織', to: '/organization', paths: ['/organization'] },
  { label: '收益', to: '/bonuses', paths: ['/bonuses', '/performance'] },
  { label: '商城', to: '/shop', paths: ['/shop', '/orders'] },
  { label: '我的', to: '/me', paths: ['/me', '/content', '/notifications'] },
];

export function sectionMatches(pathname: string, paths: string[]) {
  return paths.some(path => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));
}

export function MemberNavigation() {
  const { pathname } = useLocation();
  return <MemberBottomNav>{memberSections.map(section => {
    const active = sectionMatches(pathname, section.paths);
    return <Link key={section.to} to={section.to} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{section.label}</Link>;
  })}</MemberBottomNav>;
}

export function IncomeNavigation() {
  return <div className="uc-income-nav" role="navigation" aria-label="收益分類">
    <NavLink to="/bonuses">獎金明細</NavLink>
    <NavLink to="/performance">我的業績</NavLink>
  </div>;
}
