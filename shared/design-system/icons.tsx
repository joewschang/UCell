import type {ReactNode,SVGProps} from 'react';

export type UCellIconName =
  | 'dashboard'|'people'|'applications'|'line-links'|'paper-intake'|'qualifications'
  | 'products'|'packages'|'orders'|'binary-trees'|'organization'|'subscriptions'
  | 'bonuses'|'returns'|'workflows'|'reservoirs'|'payouts'|'content'|'documents'
  | 'audit'|'reports'|'analytics'|'uat'|'system'|'provider-operations'
  | 'home'|'income'|'shop'|'me'|'notification'|'scan'|'shipment';

type PathDef={d:string;fill?:boolean};
const P:Record<UCellIconName,PathDef[]>={
 dashboard:[{d:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z'}],
 people:[{d:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20v-2c0-3 2-5 5-5s5 2 5 5v2m1-6c3 0 5 1.6 5 4v2'}],
 applications:[{d:'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h6 M9 16h6'}],
 'line-links':[{d:'M9 15 7 17a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0m5-1 2-2a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0M9 15l6-6'}],
 'paper-intake':[{d:'M8 4h8M9 2h6l1 3H8z M6 4H4v18h16V4h-2 M8 10h8 M8 14h8 M8 18h5'}],
 qualifications:[{d:'M12 3 15 6l4 .6-1 3.6 1 3.8-4 .5-3 2.5-3-2.5-4-.5 1-3.8-1-3.6L9 6z M12 8v5'}],
 products:[{d:'m4 8 8-4 8 4-8 4z M4 8v9l8 4 8-4V8 M12 12v9'}],
 packages:[{d:'M3 7 8 4l5 3-5 3z M3 7v6l5 3 5-3V7 M13 9l3-2 5 3-5 3-3-2 M16 13v6l5-3v-6'}],
 orders:[{d:'M5 4h14v17l-2-1.5L15 21l-3-1.5L9 21l-2-1.5L5 21z M8 8h8 M8 12h8 M8 16h5'}],
 'binary-trees':[{d:'M12 3v5 M6 11h12 M6 11v4 M18 11v4 M12 8v3 M12 11v4 M4 15h4v4H4z M10 15h4v4h-4z M16 15h4v4h-4z'}],
 organization:[{d:'M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 6v4 M5 10h14 M5 10v1 M19 10v1'}],
 subscriptions:[{d:'M5 7a8 8 0 0 1 13-1l2 2 M20 4v4h-4 M19 17a8 8 0 0 1-13 1l-2-2 M4 20v-4h4'}],
 bonuses:[{d:'M12 3v18 M16 7c0-2-2-3-4-3S8 5 8 7s2 3 4 3 4 1 4 3-2 4-4 4-4-1-4-3'}],
 returns:[{d:'M8 7H3v-5 M3 7l5-5 M4 12a8 8 0 1 0 3-6'}],
 workflows:[{d:'M5 5h5v5H5z M14 14h5v5h-5z M10 7h5a3 3 0 0 1 3 3v4 M14 17H9a3 3 0 0 1-3-3v-4'}],
 reservoirs:[{d:'M4 6c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3Zm0 0v6c0 2 3.6 3 8 3s8-1 8-3V6 M4 12v6c0 2 3.6 3 8 3s8-1 8-3v-6'}],
 payouts:[{d:'M3 7h18v12H3z M3 10h18 M7 15h4 M16 14h2'}],
 content:[{d:'M5 4h14v16H5z M10 8l6 4-6 4z'}],
 documents:[{d:'M4 5h7l2 2h7v13H4z M8 11h8 M8 15h8'}],
 audit:[{d:'M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6z M8 12l3 3 5-6'}],
 reports:[{d:'M5 20V10h3v10 M11 20V4h3v16 M17 20v-7h3v7'}],
 analytics:[{d:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 1.4 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6'}],
 uat:[{d:'M5 4h14v16H5z M8 9l2 2 5-5 M8 15h8'}],
 system:[{d:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6 7 7 M17 17l1.4 1.4 M18.4 5.6 17 7 M7 17l-1.4 1.4'}],
 'provider-operations':[{d:'M7 8a5 5 0 0 1 9-2 4 4 0 0 1 1 8H7a3 3 0 1 1 0-6 M9 17h6 M12 14v6'}],
 home:[{d:'m3 11 9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7'}],
 income:[{d:'M4 19V9h4v10 M10 19V5h4v14 M16 19v-7h4v7'}],
 shop:[{d:'M4 8h16l-1 13H5z M8 8a4 4 0 0 1 8 0'}],
 me:[{d:'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 3-7 8-7s8 3 8 7'}],
 notification:[{d:'M6 17h12l-2-3V9a4 4 0 0 0-8 0v5z M10 20h4'}],
 scan:[{d:'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5 M8 8v8 M11 8v8 M14 8v8 M17 8v8'}],
 shipment:[{d:'M3 6h11v11H3z M14 10h4l3 4v3h-7z M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'}],
};

export function UCellIcon({name,size=20,title,className,...props}:{name:UCellIconName;size?:number;title?:string;className?:string}&Omit<SVGProps<SVGSVGElement>,'name'>){
 const decorative=!title;
 return <svg {...props} className={['uc-icon',className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={decorative||undefined} role={title?'img':undefined}>{title&&<title>{title}</title>}{P[name].map((p,i)=><path key={i} d={p.d} fill={p.fill?'currentColor':'none'}/>)}</svg>
}

export type QualificationBadgeCode='STARTER'|'ELITE'|'LEADER';
const qualificationMeta:Record<QualificationBadgeCode,{label:string;symbol:ReactNode}>={
 STARTER:{label:'啟航',symbol:<><path d="M12 4 15 10l-3 10-3-10z"/><circle cx="12" cy="12" r="2"/></>},
 ELITE:{label:'菁英',symbol:<><path d="M12 4 18 9l-2 8-4 3-4-3-2-8z"/><path d="m9 12 2 2 4-5"/></>},
 LEADER:{label:'領袖',symbol:<><path d="m5 17-1-9 5 4 3-7 3 7 5-4-1 9z"/><path d="M6 20h12"/></>},
};
export function QualificationEmblem({code,compact=false}:{code:string;compact?:boolean}){
 const meta=qualificationMeta[code as QualificationBadgeCode]; if(!meta)return null;
 return <span className="uc-emblem uc-qualification-emblem" data-level={code} title={meta.label+'會員資格'}><svg viewBox="0 0 24 24" aria-hidden="true">{meta.symbol}</svg>{!compact&&<span>{meta.label}</span>}</span>;
}

export type GlobalRankBadgeCode='NEW_STAR'|'EXCELLENCE'|'GLORY'|'DIAMOND'|'CROWN';
const globalMeta:Record<GlobalRankBadgeCode,{label:string;symbol:ReactNode}>={
 NEW_STAR:{label:'新星',symbol:<path d="m12 3 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8z"/>},
 EXCELLENCE:{label:'卓越',symbol:<><path d="M7 19c-3-3-3-8 0-12 M17 19c3-3 3-8 0-12"/><path d="m12 5 2 4 4 .5-3 3 .8 4.5-3.8-2-3.8 2 .8-4.5-3-3 4-.5z"/></>},
 GLORY:{label:'榮耀',symbol:<><circle cx="12" cy="12" r="4"/><path d="M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3 M19 5l-3 3 M8 16l-3 3"/></>},
 DIAMOND:{label:'鑽石',symbol:<><path d="M4 9 8 4h8l4 5-8 11z"/><path d="m4 9 8 3 8-3 M8 4l4 8 4-8"/></>},
 CROWN:{label:'皇冠',symbol:<><path d="m4 17-1-10 6 5 3-8 3 8 6-5-1 10z"/><path d="M5 20h14"/></>},
};
export function GlobalRankEmblem({code,compact=false}:{code:string;compact?:boolean}){
 const meta=globalMeta[code as GlobalRankBadgeCode]; if(!meta)return null;
 return <span className="uc-emblem uc-global-emblem" data-rank={code} title={'全球池成就：'+meta.label}><svg viewBox="0 0 24 24" aria-hidden="true">{meta.symbol}</svg>{!compact&&<span>{meta.label}</span>}</span>;
}

export const globalRankDisplay=(code:string)=>globalMeta[code as GlobalRankBadgeCode]?.label??code;
