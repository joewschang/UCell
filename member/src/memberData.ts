import { demoProducts } from './commerce';
import * as validate from './validation';
import { type Dashboard, type Qualification, type Scoped, type Person, type Organization, type Binary, type Performance, type Bonus, type Ledger, type Product, type Orders } from './api';
import { memberApi as api } from './memberApi';
export const isMock = import.meta.env.VITE_ENABLE_MOCK === 'true';
const qualifications: Qualification[] = [
    { id: 'q1', code: 'Q-000123', rank: 'LEADER', active: true, ballLabel: '球 1' },
    { id: 'q2', code: 'Q-000124', rank: 'ELITE', active: false, ballLabel: '球 2' },
];
const rankNames: Record<string, string> = { STARTER: '啟航', ELITE: '菁英', LEADER: '領袖' };
export const displayRank = (rank: string) => rankNames[rank] ?? rank;
export const getQualifications = (signal?: AbortSignal) => isMock ? Promise.resolve(qualifications) : api<unknown>('/member/qualifications', { signal }).then(validate.parseQualifications);
export async function selectQualification(q:Qualification,signal:AbortSignal):Promise<Qualification>{
 if(isMock)return q;
 const result=await api<{qualificationId:string;qualification:unknown}>('/member/context/qualification',{method:'POST',signal,body:JSON.stringify({qualificationId:q.id})});
 const [selected]=validate.parseQualifications([result?.qualification]);
 if(result?.qualificationId!==q.id||selected?.id!==q.id)throw new Error('資格確認回應不符，已停止切換');
 return selected;
}
export type Repurchase={qualificationId:string;period:string;status:'ACTIVE'|'PENDING'|'INACTIVE';recognitions:{id:string;status:string;dueAt:string}[]};
export async function getRepurchaseStatus(q:Qualification,signal:AbortSignal):Promise<Repurchase>{
 if(isMock)return {qualificationId:q.id,period:'DEMO',status:q.active?'ACTIVE':'INACTIVE',recognitions:[]};
 const result=await api<Repurchase>('/member/repurchase/status?'+new URLSearchParams({qualificationId:q.id}),{signal});
 if(result?.qualificationId!==q.id||!/^\d{4}-(0[1-9]|1[0-2])$/.test(result.period)||!['ACTIVE','PENDING','INACTIVE'].includes(result.status)||!Array.isArray(result.recognitions)||!result.recognitions.every(row=>typeof row.id==='string'&&['SCHEDULED','DUE','RECOGNIZED','CANCELLED','REVERSED'].includes(row.status)&&Number.isFinite(Date.parse(row.dueAt))))throw new Error('重購資料格式或資格不符，已停止顯示');
 return result;
}
export const getPerson = (signal: AbortSignal) => isMock ? Promise.resolve<Person>({ name:'示範會員',alias:null,memberNo:'DEMO-000001',email:null,phone:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null }) : api<unknown>('/member/me', { signal }).then(validate.parsePerson);
export type RequiredContract={id:string;type:string;version:string;title:string;content:string;contentHash:string;required:boolean;effectiveFrom:string;effectiveTo:string|null;acceptedAt:string|null};
export async function getRequiredContracts(signal:AbortSignal){
 const rows=await api<unknown>('/member/contracts/required',{signal});
 if(!Array.isArray(rows)||!rows.every(value=>{const row=value as RequiredContract;return row&&typeof row.id==='string'&&typeof row.type==='string'&&typeof row.version==='string'&&typeof row.title==='string'&&typeof row.content==='string'&&/^[a-f0-9]{64}$/.test(row.contentHash)&&row.required===true&&typeof row.effectiveFrom==='string'&&(row.effectiveTo===null||typeof row.effectiveTo==='string')&&(row.acceptedAt===null||typeof row.acceptedAt==='string');}))throw new Error('合約資料格式異常，已停止註冊');
 return rows as RequiredContract[];
}
export type NetworkRegistrationInput={contractVersionId:string;accepted:true;legalName:string;alias:string;gender:string;birthDate:string;mobile:string;email:string};
export async function registerNetworkMember(input:NetworkRegistrationInput,key:string){
 const result=await api<{personId:string;membershipState:string;enabledAuthenticationProvider:string;qualificationCreated:boolean;replayed:boolean}>('/member/registration/network',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(input)});
 if(typeof result?.personId==='string'&&result.personId&&result.membershipState==='NETWORK_MEMBER'&&result.enabledAuthenticationProvider==='LINE'&&result.qualificationCreated===false)return result;
 throw new Error('註冊結果格式異常，請重新載入');
}
export type DeliveryProfile={recipientName:string|null;phone:string|null;countryCode:string|null;postalCode:string|null;region:string|null;city:string|null;address:string|null;complete:boolean;updatedAt:string|null};
export async function getDeliveryProfile(signal:AbortSignal):Promise<DeliveryProfile>{
 const row=await api<DeliveryProfile>('/member/delivery-profile',{signal});
 const nullable=(value:unknown)=>value===null||typeof value==='string';if(!row||typeof row.complete!=='boolean'||![row.recipientName,row.phone,row.countryCode,row.postalCode,row.region,row.city,row.address,row.updatedAt].every(nullable))throw new Error('配送資料格式異常，已停止結帳');return row;
}
export type DeliveryProfileInput={recipientName:string;phone:string;countryCode:string;postalCode?:string;region:string;city:string;address:string};
export async function updateDeliveryProfile(input:DeliveryProfileInput,key:string){const result=await api<{deliveryProfileId:string;status:string;complete:boolean;updatedAt:string;replayed:boolean}>('/member/delivery-profile',{method:'PATCH',headers:{'Idempotency-Key':key},body:JSON.stringify(input)});if(!result||typeof result.deliveryProfileId!=='string'||result.status!=='UPDATED'||result.complete!==true||!Number.isFinite(Date.parse(result.updatedAt)))throw new Error('配送資料更新結果異常');return result;}
export async function createReferralShareLink(q:Qualification){const result=await api<{qualificationId:string;shareUrl:string;expiresAt:string}>('/member/share-links',{method:'POST',body:JSON.stringify({qualificationId:q.id})});if(!result||result.qualificationId!==q.id||typeof result.shareUrl!=='string'||!/^https:\/\//.test(result.shareUrl)||!Number.isFinite(Date.parse(result.expiresAt)))throw new Error('推薦連結回應不符，已停止顯示');return result;}
export async function updateProfile(input:{name?:string;email?:string;phone?:string},key:string) {
 if(isMock)throw new Error('示範模式不修改會員資料');
 return validate.parsePerson(await api('/member/profile',{method:'PATCH',headers:{'Idempotency-Key':key},body:JSON.stringify(input)}));
}
export async function revokeMemberSession(key:string){
 const result=await api<{status:string}>('/member/logout',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({intent:'LOGOUT'})});
 if(result?.status!=='REVOKED')throw new Error('無法確認伺服器登出結果');
}
export async function markNotificationRead(q:Qualification,notificationId:string,key:string){
 const result=await api<{qualificationId:string;notificationId:string;readAt:string}>(`/member/notifications/${encodeURIComponent(notificationId)}/read`,{method:'PATCH',headers:{'Idempotency-Key':key},body:JSON.stringify({qualificationId:q.id})});
 if(result.qualificationId!==q.id||result.notificationId!==notificationId||typeof result.readAt!=='string'||!Number.isFinite(Date.parse(result.readAt)))throw new Error('通知已讀回應不符，已停止顯示');
 return result;
}
export type ConnectedOrder={qualificationId:string;id:string;status:string;total:string;createdAt:string;lines:{productId:string;name:string;quantity:string;unitPrice?:string;amount:string}[]};
function parseConnectedOrder(value:unknown,q:Qualification):ConnectedOrder{
 const row=value as ConnectedOrder;
 if(!row||row.qualificationId!==q.id||typeof row.id!=='string'||typeof row.total!=='string'||!/^\d+(\.\d+)?$/.test(row.total)||typeof row.status!=='string'||!Array.isArray(row.lines)||!row.lines.every(line=>typeof line.name==='string'&&typeof line.quantity==='string'&&typeof line.amount==='string'))throw new Error('訂單格式或資格不符，已停止顯示');
 return row;
}
export async function createConnectedOrder(q:Qualification,items:{productId:string;quantity:string}[],key:string){
 return parseConnectedOrder(await api('/member/orders',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({qualificationId:q.id,items})}),q);
}
export async function getConnectedOrder(q:Qualification,id:string,signal:AbortSignal){
 return parseConnectedOrder(await api(`/member/orders/${encodeURIComponent(id)}?${new URLSearchParams({qualificationId:q.id})}`,{signal}),q);
}
export async function getNotifications(q:Qualification,signal:AbortSignal){
 const result=await api<{qualificationId:string;notices:unknown[]}>('/member/notifications?'+new URLSearchParams({qualificationId:q.id}),{signal});
 if(result.qualificationId!==q.id||!Array.isArray(result.notices))throw new Error('通知資格或資料格式不符');
 const ids=new Set<string>();
 return result.notices.map(value=>{
  const row=value as import('./NotificationContext').Notice;
  if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||![null,q.id].includes(row.qualificationId)||!['SERVICE','ORDER','ACCOUNT'].includes(row.category)||![row.title,row.body,row.timeLabel].every(v=>typeof v==='string')||!(row.readAt===null||typeof row.readAt==='string'&&Number.isFinite(Date.parse(row.readAt))))throw new Error('通知格式異常，已停止顯示');
  ids.add(row.id);return row;
 });
}
async function scoped<T extends Scoped>(path: string, q: Qualification, sample: T, signal: AbortSignal, parse: (value: unknown) => T, period?: string): Promise<T> {
    if (isMock)
        return sample;
    const query = new URLSearchParams({ qualificationId: q.id });
    if (period)
        query.set('period', period);
    const result = await api<T>(`/member/${path}?${query}`, { signal });
    if (result?.qualificationId !== q.id)
        throw new Error('回傳資格不符，已停止顯示資料');
    if (period && (result as T & {
        period?: string;
    }).period !== period)
        throw new Error('回傳期間不符，已停止顯示資料');
    return parse(result);
}
export async function getDashboard(q: Qualification, signal: AbortSignal): Promise<Dashboard> {
    if (isMock)
        return { memberName: '示範會員', memberNo: 'DEMO-000001', qualification: q, monthlyRepurchaseStatus: q.active ? 'ACTIVE' : 'INACTIVE', pv: q.id === 'q1' ? 2880 : null, rpv: q.id === 'q1' ? 1200 : null, epv: q.id === 'q1' ? 1680 : null, bonusAmount: null, bonusStatus: 'PENDING' };
    const result = await api<Dashboard>(`/member/dashboard?qualificationId=${encodeURIComponent(q.id)}`, { signal });
    if (result?.qualification?.id !== q.id)
        throw new Error('回傳資格不符，已停止顯示資料');
    return validate.parseDashboard(result);
}
export const getOrganization = (q: Qualification, s: AbortSignal) => scoped<Organization>('organization/sponsor', q, { qualificationId: q.id, sponsor: { code: q.id === 'q1' ? 'DEMO-S01' : 'DEMO-S02', name: '示範推薦人' }, referrals: q.id === 'q1' ? [{ code: 'DEMO-R01', name: '示範直推會員' }] : [] }, s, validate.parseOrganization);
export const getBinary = (q: Qualification, s: AbortSignal) => scoped<Binary>('organization/binary', q, { qualificationId: q.id, left: { count: q.id === 'q1' ? 3 : 0, volume: null }, right: { count: q.id === 'q1' ? 2 : 0, volume: null } }, s, validate.parseBinary);
export const getPerformance = (q: Qualification, p: string, s: AbortSignal) => scoped<Performance>('performance', q, { qualificationId: q.id, period: p, pv: null, rpv: null, epv: null, left: null, right: null, asOf: null }, s, validate.parsePerformance, p);
export const getBonuses = (q: Qualification, p: string, s: AbortSignal) => scoped<Bonus>('bonuses', q, { qualificationId: q.id, period: p, awards: ['推薦獎金', '對碰獎金', '對等獎金', '全球獎金'].map((name, i) => ({ id: `${q.id}-${i}`, name, status: 'PENDING', amount: null })) }, s, validate.parseBonus, p);
export const getLedger = (q: Qualification, p: string, s: AbortSignal) => scoped<Ledger>('bonuses/ledger', q, { qualificationId: q.id, period: p, entries: [] }, s, validate.parseLedger, p);
export const getProducts = (signal: AbortSignal) => isMock ? Promise.resolve<Product[]>(demoProducts) : api<unknown>('/member/products', { signal }).then(validate.parseProducts);
export const getOrders = (q: Qualification, s: AbortSignal) => scoped<Orders>('orders', q, { qualificationId: q.id, orders: q.id === 'q1' ? [{ id: 'DEMO-ORDER-001', createdAt: '2026-09-15', total: 4800, status: '處理中', paymentStatus: '待付款', shipmentStatus: '未出貨' }] : [] }, s, validate.parseOrders);
