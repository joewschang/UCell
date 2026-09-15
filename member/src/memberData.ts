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
export const getPerson = (signal: AbortSignal) => isMock ? Promise.resolve<Person>({ name: '示範會員', memberNo: 'DEMO-000001', email: null, phone: null }) : api<unknown>('/member/me', { signal }).then(validate.parsePerson);
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
