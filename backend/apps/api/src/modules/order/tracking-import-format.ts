import {isISO8601} from 'class-validator';
import {createHash} from 'node:crypto';
export const TRACKING_HEADERS=['format_version','source_system','event_id','order_no','fulfillment_key','carrier','tracking_no','status','occurred_at','external_order_no','note'] as const;
export type TrackingRow=Record<typeof TRACKING_HEADERS[number],string>&{row:number};
export const trackingHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function parseTrackingCsv(input:string):TrackingRow[]{
 if(Buffer.byteLength(input,'utf8')>262144)throw new Error('檔案超過 256 KiB，請分批匯入。');
 const text=input.replace(/^\uFEFF/,''),records:string[][]=[];let fields:string[]=[],field='',quoted=false,closed=false;
 const push=()=>{fields.push(field);field='';closed=false;};
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
 if(c==='"'){if(field||closed)throw new Error('CSV 引號格式不正確。');quoted=true;}
 else if(c===',')push();else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;push();if(fields.some(Boolean))records.push(fields);fields=[];}else{if(closed)throw new Error('CSV 引號後只能接逗號或換行。');field+=c;}}
 if(quoted)throw new Error('CSV 雙引號未關閉。');push();if(fields.some(Boolean))records.push(fields);
 if(records.shift()?.join(',')!==TRACKING_HEADERS.join(','))throw new Error('欄位名稱或順序不符，請下載 v1 範本。');
 if(!records.length||records.length>500)throw new Error('請提供 1–500 筆事件。');
 return records.map((cells,index)=>{if(cells.length!==TRACKING_HEADERS.length)throw new Error(`第 ${index+2} 列欄位數量不符。`);return Object.assign(Object.fromEntries(TRACKING_HEADERS.map((key,i)=>[key,cells[i].trim()])),{row:index+2}) as unknown as TrackingRow;});
}
export function validateTrackingRow(r:TrackingRow,now=Date.now()):string|undefined{
 if(r.format_version!=='1')return 'format_version 必須為 1。';
 if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(r.source_system))return '來源代碼必須為 1–40 位英數字、底線或連字號。';
 if(!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(r.event_id))return '事件編號格式不正確。';
 if(!/^[1-9][0-9]{0,17}$/.test(r.order_no))return 'UCell 訂單編號必須為 1–18 位數字文字。';
 for(const [key,max] of [['fulfillment_key',200],['carrier',80],['tracking_no',200]] as const)if(!r[key]||r[key].length>max||/^[=+@-]|[\r\n\x00-\x1f]/.test(r[key]))return `${key} 缺漏或格式不正確。`;
 if(!['READY','LABEL_CREATED','PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED','RETURNING','RETURNED','CANCELLED'].includes(r.status))return '不支援的物流狀態代碼。';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(r.occurred_at)||!isISO8601(r.occurred_at,{strict:true,strictSeparator:true})||!Number.isFinite(Date.parse(r.occurred_at)))return '事件時間必須是包含時區的 ISO 8601 格式。';
 if(Date.parse(r.occurred_at)>now+300000)return '事件時間不可晚於現在超過 5 分鐘。';
 if(r.external_order_no.length>100||r.note.length>250)return '外部訂單號最多 100 字，備註最多 250 字。';
 if([r.external_order_no,r.note].some(v=>/^[=+@-]|\x00/.test(v)))return '文字欄位不可包含試算表公式或控制字元。';
}
export function rowPayload(r:TrackingRow){const {row,...value}=r;return value;}
