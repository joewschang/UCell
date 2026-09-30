import {ErpBusinessProjectionPanel} from './ErpBusinessProjectionPanel';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {AdminDataGrid,type GridColumn} from '../../components/AdminDataGrid';
import {QueryFeedback} from '../../components/QueryFeedback';
import {Badge,Card,Field,Metric,PageHeader} from '../../components/ui';
import {get,qs} from '../../lib/api';

type Lifecycle='READY'|'QUEUED'|'SENT'|'ACKNOWLEDGED'|'RECONCILED'|'MISMATCH'|'FAILED'|'BLOCKED_EXTERNAL';
type Item={orderNo:string;fulfillmentKey:string;bridgeStatus:Lifecycle;ucell:{orderStatus:string;fulfillmentStatus:string};erp:{provider:string;connection:string|null;formatVersion:string;outboxStatus:string;attemptCount:number;latestAttemptOutcome:string|null;providerReference:string|null;expected:{sku:string;quantity:string;serialCount:number}[];actual:{sku:string;quantity:string;serialCount:number}[];reconciliationOutcome:string|null;reasonCode:string|null};shipment:{status:string;count:number};evidence:{payloadHash:string;resultHash:string|null;exceptionReference:string|null;exceptionCode:string|null;exceptionSeverity:string|null;exceptionStatus:string|null};timestamps:{queuedAt:string;sentAt:string|null;acknowledgedAt:string|null;reconciledAt:string|null;dataThrough:string}};
type Page={asOf:string;dataThrough:string;items:Item[];nextCursor:string|null;limit:number;authority:{ucell:string;erp:string;shipment:string};liveTransportStatus:string};
const statuses:Lifecycle[]=['READY','QUEUED','SENT','ACKNOWLEDGED','RECONCILED','MISMATCH','FAILED','BLOCKED_EXTERNAL'];
const time=(value:string|null)=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
const tone=(value:string)=>value==='RECONCILED'||value==='DELIVERED'?'ok':value==='MISMATCH'||value==='FAILED'||value==='DELIVERY_FAILED'?'danger':value==='BLOCKED_EXTERNAL'?'warn':'neutral';
const lines=(value:Item['erp']['expected'])=>value.length?value.map(row=>`${row.sku} × ${row.quantity}（序號 ${row.serialCount}）`).join('、'):'—';
const columns:GridColumn<Item>[]=[
 {key:'orderNo',label:'訂單／出貨',value:r=>`${r.orderNo} ${r.fulfillmentKey}`,render:r=><><strong>{r.orderNo}</strong><br/><span className="muted">{r.fulfillmentKey}</span></>},
 {key:'bridgeStatus',label:'Bridge',value:r=>r.bridgeStatus,render:r=><Badge tone={tone(r.bridgeStatus)}>{r.bridgeStatus}</Badge>},
 {key:'ucell',label:'UCell 權威狀態',value:r=>`${r.ucell.orderStatus} ${r.ucell.fulfillmentStatus}`,render:r=><>{r.ucell.orderStatus}<br/><span className="muted">Fulfillment {r.ucell.fulfillmentStatus}</span></>},
 {key:'erp',label:'ERP 權威狀態',value:r=>`${r.erp.provider} ${r.erp.latestAttemptOutcome??''} ${r.erp.reconciliationOutcome??''}`,render:r=><>{r.erp.provider} · {r.erp.latestAttemptOutcome??'尚未受理'}<br/><span className="muted">對帳 {r.erp.reconciliationOutcome??'尚無'} · 嘗試 {r.erp.attemptCount}</span></>},
 {key:'shipment',label:'Shipment 權威狀態',value:r=>r.shipment.status,render:r=><Badge tone={tone(r.shipment.status)}>{r.shipment.status}</Badge>},
 {key:'expected',label:'交付快照',value:r=>lines(r.erp.expected),render:r=><span>{lines(r.erp.expected)}</span>},
 {key:'evidence',label:'差異／證據',value:r=>`${r.erp.reasonCode??''} ${r.evidence.exceptionReference??''}`,render:r=><>{r.erp.reasonCode??'無差異碼'}{r.evidence.exceptionReference&&<><br/><code>{r.evidence.exceptionReference}</code> · {r.evidence.exceptionStatus}</>}</>},
 {key:'updated',label:'Data through',value:r=>r.timestamps.dataThrough,render:r=><>{time(r.timestamps.reconciledAt??r.timestamps.acknowledgedAt??r.timestamps.queuedAt)}<br/><span className="muted">截點 {time(r.timestamps.dataThrough)}</span></>},
];

export function ErpReconciliationPage(){
 const [draftOrder,setDraftOrder]=useState(''),[draftStatus,setDraftStatus]=useState(''),[orderNo,setOrderNo]=useState(''),[status,setStatus]=useState(''),[cursor,setCursor]=useState<string|undefined>(),[asOf,setAsOf]=useState<string|undefined>();
 const query=useQuery({queryKey:['erp-reconciliation',orderNo,status,cursor,asOf],queryFn:()=>get<{data:Page}>('/admin/erp-reconciliation'+qs({orderNo,status,cursor,asOf,take:50})),refetchInterval:60_000});
 const data=query.data?.data,counts=(data?.items??[]).reduce<Record<string,number>>((sum,row)=>(sum[row.bridgeStatus]=(sum[row.bridgeStatus]??0)+1,sum),{});
 function apply(){setOrderNo(draftOrder.trim());setStatus(draftStatus);setCursor(undefined);setAsOf(undefined);}
 return <><PageHeader title="ERP 對接與對帳" subtitle="分開顯示 UCell、ERP 與物流權威狀態；ERP 受理不代表付款或已出貨。" actions={<button onClick={()=>void query.refetch()}>重新整理</button>}/>
  <Card title="權威邊界"><p><strong>UCell：</strong>訂單與出貨配置。<strong> ERP：</strong>已保存的交付、受理與對帳證據。<strong> Shipment：</strong>獨立物流事實。</p><p className="muted">EZTooL live transport：{data?.liveTransportStatus??'讀取中'}。本頁不顯示憑證、收件資料、會員個資或內部 UUID。</p></Card>
  <Card title="查詢"><form onSubmit={e=>{e.preventDefault();apply()}}><div className="filter-grid"><Field label="訂單號"><input inputMode="numeric" pattern="[0-9]{1,19}" value={draftOrder} onChange={e=>setDraftOrder(e.target.value)}/></Field><Field label="Bridge 狀態"><select value={draftStatus} onChange={e=>setDraftStatus(e.target.value)}><option value="">全部</option>{statuses.map(value=><option key={value}>{value}</option>)}</select></Field></div><div className="button-row"><button className="primary" type="submit">套用</button><button type="button" onClick={()=>{setDraftOrder('');setDraftStatus('');setOrderNo('');setStatus('');setCursor(undefined);setAsOf(undefined)}}>清除</button></div></form></Card>
  <QueryFeedback query={query} empty={!!data&&!data.items.length&&!data.nextCursor}/>{data&&!data.items.length&&data.nextCursor&&<p>此頁沒有符合狀態的交付，後續頁面仍有資料可查。</p>}{data&&<><div className="metrics"><Metric label="本頁筆數" value={data.items.length}/><Metric label="已對帳" value={counts.RECONCILED??0}/><Metric label="差異" value={counts.MISMATCH??0}/><Metric label="失敗／外部阻擋" value={(counts.FAILED??0)+(counts.BLOCKED_EXTERNAL??0)}/></div>{data.items.length>0&&<Card title="ERP Bridge 快照"><AdminDataGrid rows={data.items} columns={columns} rowId={r=>`${r.orderNo}:${r.fulfillmentKey}`} label="ERP reconciliation bridge" searchable/><p className="muted">交付建立截點：{time(data.asOf)} · 狀態讀取時間：{time(data.dataThrough)}</p></Card>}{data.nextCursor&&<Card><button onClick={()=>{setAsOf(data.asOf);setCursor(data.nextCursor!)}}>下一頁（固定交付建立截點）</button></Card>}</>}
 <ErpBusinessProjectionPanel/></>;
}
