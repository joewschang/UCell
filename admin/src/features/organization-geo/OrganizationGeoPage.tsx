import {useRef,useState} from 'react';
import {get,adminToken,qs,ApiError} from '../../lib/api';
import {Card,PageHeader,Field,Metric,ErrorBox} from '../../components/ui';
import {useAuth} from '../auth/auth';
import map from './taiwan-map.json';
import './organization-geo.css';

type Measure={balls:number;members:number;activeBalls:number;activeRate:number|null;newBalls:number;gpv:string|null;unknownActiveBalls:number};
type Row=Measure&{areaCode:string;areaName:string;status:string};
type Summary=Measure&{descendantBalls:number;uniqueMembers:number;unlocatedBalls:number;districtUnlocatedBalls:number;leftBalls:number;rightBalls:number};
type Result={status:string;reason:string|null;rootBallNo:string;summary:Summary|null;distribution:Row[];branchComparison:Array<{regionGroup:string;left:Measure;right:Measure}>;time:{asOf:string;knowledgeCutoff:string;periodStart:string;periodEnd:string};carry:{status:string;value:{left:string;right:string;pairedPv:string|null}|null}|null};
type MetricKey='balls'|'members'|'activeBalls'|'newBalls'|'gpv';
const labels:Record<MetricKey,string>={balls:'球數',members:'會員人數',activeBalls:'Active 球數',newBalls:'新安置球數',gpv:'GPV'};
const regions:Record<string,string>={NORTH:'北部',CENTRAL:'中部',SOUTH:'南部',EAST:'東部',ISLAND:'離島',UNLOCATED:'未定位'};
const display=(value:unknown)=>value==null?'資料不足':String(value);

export function OrganizationGeoPage(){
 const {user}=useAuth(),serial=useRef(0),drillSerial=useRef(0);
 const [root,setRoot]=useState(''),[side,setSide]=useState('ALL'),[period,setPeriod]=useState('30'),[metric,setMetric]=useState<MetricKey>('balls');
 const [customFrom,setCustomFrom]=useState(''),[customTo,setCustomTo]=useState(''),[checkpoint,setCheckpoint]=useState(''),[knownAt,setKnownAt]=useState('');
 const [result,setResult]=useState<Result|null>(null),[district,setDistrict]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
 const [context,setContext]=useState<Record<string,string>|null>(null),[trend,setTrend]=useState<Array<{periodStart:string;summary:Summary|null;status:string}>|null>(null);
 const [districtCode,setDistrictCode]=useState<string|null>(null);
 const canDrill=['SUPER_ADMIN','ORG_GEO_DRILLDOWN','ORG_GEO_EXPORT'].includes(user?.role??''),canExport=['SUPER_ADMIN','ORG_GEO_EXPORT'].includes(user?.role??'');
 const canQuery=user?.provider==='ENTRA';
 function clear(){serial.current++;setResult(null);setDistrict(null);setDistrictCode(null);setTrend(null);setContext(null);setError(null);setBusy(false);}
 async function load(event:React.FormEvent){
  if(!canQuery){event.preventDefault();return;}
  event.preventDefault();const id=++serial.current;setBusy(true);setError(null);setResult(null);setDistrict(null);setDistrictCode(null);setTrend(null);
  const now=checkpoint?new Date(checkpoint+':00+08:00'):new Date(),knowledge=knownAt?new Date(knownAt+':00+08:00'):new Date();
  const from=period==='CUSTOM'?new Date(customFrom+'T00:00:00+08:00'):period==='YTD'?new Date(`${now.toLocaleDateString('en-CA',{timeZone:'Asia/Taipei',year:'numeric'})}-01-01T00:00:00+08:00`):period==='ALL'?new Date('1970-01-01T00:00:00.000Z'):new Date(now.getTime()-Number(period)*86400000);
  const until=period==='CUSTOM'?new Date(customTo+'T00:00:00+08:00'):now;
  const query={rootBallNo:root.trim().toUpperCase(),side,level:'CITY',dateFrom:from.toISOString(),dateTo:until.toISOString(),asOf:now.toISOString(),knowledgeCutoff:knowledge.toISOString()};
  try{const response=await get<{data:Result}>('/admin/organization/geo/summary'+qs(query));if(id!==serial.current)return;setResult(response.data);setContext(query);}
  catch(e){if(id===serial.current)setError(e);}finally{if(id===serial.current)setBusy(false);}
 }
 async function drill(code:string){
  if(!context||!canDrill||code==='UNLOCATED')return;const id=serial.current,request=++drillSerial.current;setError(null);setDistrict(null);setDistrictCode(null);
  try{const response=await get<{data:Result}>('/admin/organization/geo/distribution'+qs({...context,level:'DISTRICT',parentAreaCode:code}));if(id===serial.current&&request===drillSerial.current){setDistrict(response.data);setDistrictCode(code);}}catch(e){if(id===serial.current&&request===drillSerial.current)setError(e);}
 }
 async function loadTrend(){
  if(!context)return;const id=serial.current;setError(null);
  try{const response=await get<{data:{rows:Array<{periodStart:string;summary:Summary|null;status:string}>}}>('/admin/organization/geo/trend'+qs({...context,interval:period==='30'?'DAY':period==='90'?'WEEK':'MONTH'}));if(id===serial.current)setTrend(response.data.rows);}catch(e){if(id===serial.current)setError(e);}
 }
 async function download(){
  if(!context||!canExport)return;setError(null);const id=serial.current,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const headers=new Headers(),token=adminToken();if(token)headers.set('Authorization','Bearer '+token);
   const response=await fetch((import.meta.env.VITE_API_BASE_URL??'/api/v1')+'/admin/organization/geo/export'+qs({...context,...(districtCode?{level:'DISTRICT',parentAreaCode:districtCode}:{})}),{headers,cache:'no-store',signal:controller.signal});
   if(response.status===401)window.dispatchEvent(new CustomEvent('ucell:admin-unauthorized'));
   if(!response.ok)throw new ApiError(response.status,null,'地理資料匯出失敗');
   const blob=await response.blob();if(id!==serial.current)return;
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ucell-geo.csv';link.click();URL.revokeObjectURL(url);
  }catch(e){if(id===serial.current)setError(e);}finally{clearTimeout(timer);}
 }
 const rows=(district??result)?.distribution??[],cityRows=result?.distribution??[];
 const maximum=Math.max(0,...cityRows.map(row=>Number(row[metric]??0)));
 const top=[...cityRows].filter(r=>r.areaCode!=='UNLOCATED'&&r[metric]!=null).sort((a,b)=>Number(b[metric])-Number(a[metric])).slice(0,10);
 const top3Balls=[...cityRows].filter(r=>r.areaCode!=='UNLOCATED').sort((a,b)=>b.balls-a.balls).slice(0,3).reduce((total,row)=>total+row.balls,0);
 const summary=result?.summary;
 return <div className="geo-page"><PageHeader title="地理組織分析" subtitle="依 Binary 子樹、歷史持有人與通訊地址，查看市場分布。"/>
  <Card title="查詢範圍"><form onSubmit={load} className="geo-filters">
   <Field label="根球號"><input required placeholder="例如 A000001" value={root} onChange={e=>{clear();setRoot(e.target.value);}}/></Field>
   <Field label="分區"><select value={side} onChange={e=>{clear();setSide(e.target.value);}}><option value="ALL">全部後代</option><option value="LEFT">左區</option><option value="RIGHT">右區</option></select></Field>
   <Field label="期間"><select value={period} onChange={e=>{clear();setPeriod(e.target.value);}}><option value="30">近 30 天</option><option value="90">近 90 天</option><option value="YTD">今年</option><option value="ALL">全部期間</option><option value="CUSTOM">自訂期間</option></select></Field>
   {period==='CUSTOM'&&<><Field label="開始日期"><input type="date" required value={customFrom} onChange={e=>{clear();setCustomFrom(e.target.value);}}/></Field><Field label="結束日期（不含當日）"><input type="date" required value={customTo} min={customFrom||undefined} onChange={e=>{clear();setCustomTo(e.target.value);}}/></Field></>}
   <Field label="歷史時間（台北；留空為現在）"><input type="datetime-local" value={checkpoint} onChange={e=>{clear();setCheckpoint(e.target.value);}}/></Field>
   <Field label="已知資料截止（台北；留空為現在）"><input type="datetime-local" value={knownAt} onChange={e=>{clear();setKnownAt(e.target.value);}}/></Field>
   <Field label="指標"><select value={metric} onChange={e=>setMetric(e.target.value as MetricKey)}>{Object.entries(labels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></Field>
   <button disabled={busy||!canQuery}>{busy?'查詢中…':'查詢'}</button>
  </form>{!canQuery&&<p role="status">請使用正式 Microsoft 管理員帳號登入後查詢地理資料。</p>}<p>不含根球本身；同一會員多球會分別計入球數，會員人數則去重。</p></Card>
  {error!=null&&<ErrorBox error={error}/>}
  {result&&<><p role="status">球號 {result.rootBallNo} · {result.status==='AVAILABLE'?'資料完整':result.status==='PARTIAL'?'部分證據待補':'目前無法提供'}{result.reason?' · '+result.reason:''} · 截至 {result.time.asOf}</p>
   {summary&&<><div className="geo-metrics"><Metric label="後代球數" value={summary.descendantBalls}/><Metric label="不重複會員" value={summary.uniqueMembers}/><Metric label="Active 球數" value={summary.activeBalls} helper={summary.unknownActiveBalls?`${summary.unknownActiveBalls} 球缺少 Active 證據`:undefined}/><Metric label="期間 GPV" value={display(summary.gpv)}/><Metric label="未定位球數" value={summary.unlocatedBalls}/></div>
   <Card title="台灣縣市分布"><svg viewBox={map.viewBox} className="geo-map" role="group" aria-label="台灣縣市市場分布">
    {map.paths.map(area=>{const row=cityRows.find(r=>r.areaCode===area.code),value=row?.[metric],opacity=value==null ? .12 : maximum ? .2+.8*Number(value)/maximum : .2;return <path key={area.code} d={area.path} fill="var(--ucell-emerald, #087c64)" fillOpacity={opacity} stroke="currentColor" strokeWidth=".6" fillRule="evenodd" role={canDrill?'button':'img'} tabIndex={canDrill?0:undefined} aria-label={`${area.name}，${labels[metric]} ${display(value)}`} onClick={()=>drill(area.code)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void drill(area.code);}}}><title>{area.name} · {labels[metric]} {display(value)}</title></path>;})}
   </svg><p>顏色越深代表所選指標越高；淡色或無資料不代表零。點選縣市可查看行政區。</p><small>圖資：內政部國土測繪中心 1140318 縣市界線，政府資料開放授權條款第 1 版。</small></Card>
   <Card title="市場觀察"><p>{summary.balls&&top3Balls/summary.balls>.5?'前三大縣市超過本次後代球數的一半，市場分布較集中。':'目前未達前三大縣市占後代球數一半的集中條件。'}</p><p>觀察依本次球數與期間；未定位人口另列，不推估收益。</p></Card>
   <Card title="左右區比較"><table><thead><tr><th>地區</th><th>左區球數</th><th>右區球數</th><th>左區 GPV</th><th>右區 GPV</th></tr></thead><tbody>{result.branchComparison.map(r=><tr key={r.regionGroup}><th>{regions[r.regionGroup]}</th><td>{r.left.balls}</td><td>{r.right.balls}</td><td>{display(r.left.gpv)}</td><td>{display(r.right.gpv)}</td></tr>)}</tbody></table></Card>
   <Card title={`前十大市場 · ${labels[metric]}`}>{top.length?top.map(row=><div className="geo-ranking" key={row.areaCode}><span>{row.areaName}</span><meter min="0" max={maximum||1} value={Number(row[metric]??0)} aria-label={`${row.areaName} ${labels[metric]}`}/><strong>{display(row[metric])}</strong></div>):<p>所選指標尚無足夠證據，無法排名。</p>}</Card>
   <Card title={district?'行政區明細':'縣市明細'}>{district&&<button onClick={()=>{drillSerial.current++;setDistrict(null);setDistrictCode(null);}}>返回縣市</button>}<div className="geo-table"><table><thead><tr><th>行政區</th><th>球數</th><th>會員</th><th>Active 球數</th><th>Active 比例</th><th>新球</th><th>GPV</th></tr></thead><tbody>{rows.map(row=><tr key={row.areaCode}><th>{row.areaName}</th><td>{row.balls}</td><td>{row.members}</td><td>{row.activeBalls}</td><td>{row.activeRate==null?'資料不足':(row.activeRate*100).toFixed(1)+'%'}</td><td>{row.newBalls}</td><td>{display(row.gpv)}</td></tr>)}</tbody></table></div>{canExport&&<button onClick={download}>匯出目前明細</button>}</Card>
   <Card title="時間趨勢"><button onClick={loadTrend}>載入歷史趨勢</button>{trend&&<table><thead><tr><th>日期</th><th>球數</th><th>新球</th><th>GPV</th></tr></thead><tbody>{trend.map(row=><tr key={row.periodStart}><th>{row.periodStart.slice(0,10)}</th><td>{display(row.summary?.balls)}</td><td>{display(row.summary?.newBalls)}</td><td>{display(row.summary?.gpv)}</td></tr>)}</tbody></table>}</Card>
   <Card title="結算證據"><p>左 Carry：{display(result.carry?.value?.left)} · 右 Carry：{display(result.carry?.value?.right)} · Pair PV：{display(result.carry?.value?.pairedPv)}</p><p>僅讀取已完成結算或重播證據；缺少資料時不推算。</p></Card>
  </>}</>}
 </div>;
}
