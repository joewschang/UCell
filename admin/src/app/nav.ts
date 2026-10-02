import type {UCellIconName} from '@ucell/design-system';

export const nav=[
  ['總覽','/','dashboard'],
  ['會員／自然人','/people','people'],
  ['會員申請','/applications','applications'],
  ['既有會員 LINE 補綁','/line-links','line-links'],
  ['紙本申請 Intake','/paper-intake','paper-intake'],
  ['會員資格（球）','/qualifications','qualifications'],
  ['商品參照','/products','products'],
  ['套組與資格商品','/packages','packages'],
  ['訂單與收款','/orders','orders'],
  ['出貨與序號核對','/fulfillment','shipment'],
  ['ERP 對接與對帳','/erp-reconciliation','reconciliation'],
  ['多樹管理','/admin/organization/trees','binary-trees'],
  ['地理組織分析','/organization/geo','geo'],
  ['組織／安置','/organization','organization'],
  ['重購訂閱','/subscriptions','subscriptions'],
  ['交易影響追蹤','/economic-lineage','lineage'],
  ['獎金與結算證據','/bonuses','bonuses'],
  ['結算工作','/settlement-jobs','settlement'],
  ['獎金週期控制','/compensation-period-control','calendar'],
  ['營運控制中心','/operations-control','control'],
  ['退貨／重算','/returns','returns'],
  ['升級／轉讓／退出','/workflows','workflows'],
  ['Reservoir Center','/admin/finance/reservoirs','reservoirs'],
  ['付款批次與對帳','/payouts','payouts'],
  ['影音／連結內容','/content','content'],
  ['教育訓練','/learning','learning'],
  ['活動管理','/events','events'],
  ['文件／附件','/documents','documents'],
  ['稽核紀錄','/audit','audit'],
  ['報表／完整性','/reports','reports'],
  ['NASL／十二代健康雷達','/analytics','analytics'],
  ['UAT／上線驗證','/uat','uat'],
  ['系統就緒度','/system','system'],
  ['Provider Webhook 營運','/provider-operations','provider-operations'],
] as const satisfies ReadonlyArray<readonly [string,string,UCellIconName]>;

/** A child route selects its most specific menu, while detail pages retain their parent. */
export function activeNavPath(pathname:string):string|undefined{
  return nav.map(([,path])=>path)
    .filter(path=>pathname===path || path!=='/'&&pathname.startsWith(path+'/'))
    .sort((a,b)=>b.length-a.length)[0];
}
export const navGroups=[
 {label:'Dashboard',paths:['/']},
 {label:'會員管理',paths:['/people','/qualifications','/applications','/paper-intake','/line-links','/workflows','/learning','/events']},
 {label:'組織管理',paths:['/organization','/organization/geo','/admin/organization/trees']},
 {label:'商務',paths:['/products','/packages','/orders','/fulfillment','/erp-reconciliation','/subscriptions','/returns']},
 {label:'獎金中心',paths:['/bonuses','/settlement-jobs','/compensation-period-control','/economic-lineage']},
 {label:'財務／治理',paths:['/payouts','/admin/finance/reservoirs']},
 {label:'營運分析',paths:['/operations-control','/reports','/analytics']},
 {label:'系統治理',paths:['/content','/documents','/audit','/uat','/system','/provider-operations']},
];
