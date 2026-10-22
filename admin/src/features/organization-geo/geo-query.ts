export function buildGeoQuery(input:{root:string;side:string;period:string;customFrom:string;customTo:string;checkpoint:string;knownAt:string},clock=new Date()){
 const root=input.root.trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9_-]{0,39}(?:X\d{6,}|\d{6,})$/.test(root))throw new Error('請輸入完整球號，包含樹代碼與球號序號。');
 const parse=(value:string)=>new Date(value.length===16?value+':00+08:00':value+'+08:00');
 const at=input.checkpoint?parse(input.checkpoint):clock,known=input.knownAt?parse(input.knownAt):clock;
 if(!Number.isFinite(at.getTime())||!Number.isFinite(known.getTime()))throw new Error('查詢時間格式不正確，請重新選擇日期時間。');
 if(at.getTime()>clock.getTime()+5000||known.getTime()>clock.getTime()+5000)throw new Error('查詢時間與資料截止時間不可晚於現在。');
 const taipei=new Date(at.getTime()+8*3600000);
 const from=input.period==='CUSTOM'?new Date(input.customFrom+'T00:00:00+08:00'):input.period==='YTD'?new Date(Date.UTC(taipei.getUTCFullYear(),0,1)-8*3600000):input.period==='ALL'?new Date(0):new Date(at.getTime()-Number(input.period)*86400000);
 const end=input.period==='CUSTOM'?new Date(new Date(input.customTo+'T00:00:00+08:00').getTime()+86400000):at;
 if(!Number.isFinite(from.getTime())||!Number.isFinite(end.getTime())||from>=end)throw new Error('請選擇有效期間；結束日期不可早於開始日期。');
 if(from>=at)throw new Error('開始日期須早於查詢時間。');
 return {rootBallNo:root,side:input.side,level:'CITY',dateFrom:from.toISOString(),dateTo:new Date(Math.min(end.getTime(),at.getTime())).toISOString(),asOf:at.toISOString(),knowledgeCutoff:known.toISOString()};
}
const copy:Record<string,string>={INVALID_GEO_TIME_CONTEXT:'查詢時間無效，請確認日期範圍及電腦時間。',GEO_ROOT_NOT_FOUND:'找不到此球號在查詢時間的安置資料；尚未安置的球無法分析地理組織。',GEO_SCALE_PROJECTION_REQUIRED:'此子樹超過即時分析上限 500 顆，請改用下層球查詢；目前未顯示不完整統計。',GEO_ADDRESS_PROJECTION_LIMIT:'地址版本資料量超過即時分析上限，請縮小查詢範圍。',CANONICAL_ANCESTRY_EVIDENCE_INCOMPLETE:'組織證據尚未完整，暫不提供統計，請由管理員查核。',GEO_HISTORICAL_OWNER_OR_PLACEMENT_MISSING:'所選時間的持有人或安置資料不完整，請調整查詢時間或查核資料。',GEO_ACTIVE_EVIDENCE_INCOMPLETE:'部分會員球缺少活躍證據，已確認數與待確認數分開呈現。',GEO_AMBIGUOUS_ADDRESS_HISTORY:'地址版本有重複證據，需查核後才能統計。',GEO_TREND_MAX_31_BUCKETS_SELECT_COARSER_INTERVAL:'趨勢最多提供 31 個區間，請縮短查詢期間後再載入。',HISTORICAL_GPV_EVIDENCE_MISSING:'業績帳本的歷史證據尚未完整，業績數值暫不提供。',HISTORICAL_GPV_EVIDENCE_INVALID:'業績歷史證據未通過驗證，請由管理員查核。',SOURCE_LIMIT_REQUIRES_PROJECTION:'業績來源筆數超過即時統計上限，請縮小子樹範圍。'};
export function geoReason(code:string|null){return code?(copy[code]??'部分統計證據尚未完整；未確認的數值顯示為資料不足。'):''}
export function geoError(error:unknown){const e=error as {body?:{code?:string;error?:{code?:string};message?:{code?:string}}};const code=e?.body?.code??e?.body?.error?.code??e?.body?.message?.code;return new Error(code?geoReason(code):error instanceof Error?error.message:'查詢失敗，請重試。');}
export function trendInterval(context:Record<string,string>){const days=(Date.parse(context.dateTo)-Date.parse(context.dateFrom))/86400000;return days<=31?'DAY':days<=217?'WEEK':'MONTH'}
