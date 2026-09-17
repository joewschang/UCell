import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get} from '../../lib/api';
import {Card} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import './analytics-volume.css';
type Amount={original:string;adjustment:string;net:string;events:number};
export type VolumeReport={status:string;reason?:string;freshness?:string;asOf?:string;from?:string;toExclusive?:string;ruleVersionCode?:string;volumes?:Array<{type:string;unit:string;total:Amount;left:Amount|null;right:Amount|null;generations:Array<Amount&{generation:number}>}>|null;carry?:{status:string;reason?:string;periodEnd?:string;basis?:string;left?:string;right?:string;originalLeft?:string;originalRight?:string}|null};
const time=(value?:string)=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'—';
const reasons:Record<string,string>={VOLUME_PROJECTION_NOT_BUILT:'尚未建立含業績量的新快照，請更新此組織快照。',VOLUME_SOURCE_LIMIT:'來源超過安全處理上限，本次不提供部分加總。',HISTORICAL_VOLUME_EVIDENCE_INCOMPLETE:'部分原始事件缺少完整歷史組織或修正證據，暫不提供各代加總。',NO_SETTLED_CARRY:'尚無 Carry 紀錄。',CARRY_PERIOD_NOT_FINALIZED:'最新 Carry 所屬期間尚未確認結算完成。',CARRY_CORRECTION_INCOMPLETE:'最新 Carry 修正缺少完整根球資料，未退回舊值。'};
export function VolumeEvidence({data}:{data:VolumeReport}){
 const [selected,setSelected]=useState('GPV');const row=data.volumes?.find(v=>v.type===selected);const maximum=row?Math.max(0,...row.generations.map(g=>Number(g.net))):0;
 return <><p>各代使用原始事件保存的歷史組織關係，可能與目前雷達成員不同。GPV、RPV、EPV 分別呈現，單位是各自業績點數，不能相加為 PV 或金額。</p>
 {data.asOf&&<p>快照：{time(data.asOf)} · {data.ruleVersionCode}。{data.freshness==='STALE'?'快照已過期，請更新。':''}</p>}
 {data.from&&<p>原始事件期間：{time(data.from)}（含）至 {time(data.toExclusive)}（不含），納入截至快照已知的退貨／重算調整。這不是退款發生期間報表。</p>}
 {data.status!=='AVAILABLE'?<p role="status">{reasons[data.reason??'']??'業績量資料不可用。'}</p>:<><label className="field"><span>業績量類型</span><select aria-label="業績量類型" value={selected} onChange={e=>setSelected(e.target.value)}>{data.volumes?.map(v=><option key={v.type}>{v.type}</option>)}</select></label>
 {row&&<><p>{row.type} 原始量 {row.total.original} · 調整 {row.total.adjustment} · 淨量 <strong>{row.total.net}</strong>，共 {row.total.events} 筆原始事件。零表示完整來源掃描中沒有相應淨量，不代表會員沒有其他互動。</p>{row.left&&row.right&&<p>歷史左區 {row.left.net} ／歷史右區 {row.right.net}</p>}
 <div className="volume-scroll"><table className="volume-table"><caption>十二代 {row.type} 業績點數 · 長條僅在本類型內比較</caption><thead><tr><th>代數</th><th>原始量</th><th>調整</th><th>淨量</th><th>相對量</th></tr></thead><tbody>{row.generations.map(g=><tr key={g.generation}><th scope="row">第 {g.generation} 代</th><td>{g.original}</td><td>{g.adjustment}</td><td>{g.net}</td><td><meter min={0} max={maximum||1} value={Number(g.net)} aria-label={`第 ${g.generation} 代 ${row.type} 淨量 ${g.net}`}/></td></tr>)}</tbody></table></div></>}
 </>}
 {data.carry&&<><h3>根球最近一期 Carry</h3>{data.carry.status==='AVAILABLE'?<><p>結算期末：{time(data.carry.periodEnd)} · GPV 點數 · {data.carry.basis==='LATEST_REPLAY_CORRECTION'?'已採最新重算修正':'原結算紀錄'}</p><p>左區 {data.carry.left} ／右區 {data.carry.right}</p><p className="muted">原結算左區 {data.carry.originalLeft} ／右區 {data.carry.originalRight}。Carry 是期末結餘，不能與近 30 天流量相加。</p></>:<p>{reasons[data.carry.reason??'']??'Carry 資料不可用。'}</p>}</>}
 </>;
}
export function AnalyticsVolumePanel({root,tree}:{root:string;tree:'sponsor'|'binary'}){
 const query=useQuery({queryKey:['analytics','volumes',root,tree],queryFn:()=>get<{data:VolumeReport}>(`/admin/analytics/sonar/${tree}/${root}/volumes`),enabled:!!root,refetchInterval:60_000});
 if(!root)return null;
 return <Card title="歷史組織業績量與 Carry"><QueryFeedback query={query}/>{!query.error&&query.data&&<VolumeEvidence data={query.data.data}/>}</Card>;
}
