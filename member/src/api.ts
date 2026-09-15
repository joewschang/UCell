import { sessionGuard, type SessionGuard } from './session';
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const expiredMessage = '登入已失效，請重新登入';
export function createApiClient(guard: SessionGuard) {
    return async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
        if (guard.getSnapshot()) throw new Error(expiredMessage);
        const token = sessionStorage.getItem('ucell_member_token');
        const headers = new Headers(init.headers);
        headers.set('Accept', 'application/json');
        if (init.body) headers.set('Content-Type', 'application/json');
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const controller = new AbortController();
        const abort = () => controller.abort();
        const unregister = guard.register(controller);
        init.signal?.addEventListener('abort', abort, { once: true });
        if (init.signal?.aborted) controller.abort();
        try {
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const res = await fetch(`${base}${path}`, {
                ...init, signal: controller.signal, headers,
                credentials: 'same-origin', cache: 'no-store',
            });
            if (guard.getSnapshot()) throw new Error(expiredMessage);
            if (!res.ok) {
                if (res.status === 401) guard.expire();
                throw new Error(res.status === 401 ? expiredMessage :
                    res.status === 403 ? '您無權查看此資格資料' : '資料暫時無法讀取，請稍後重試');
            }
            let result: T;
            try { result = await res.json() as T; }
            catch { throw new Error('資料格式異常，請稍後重試'); }
            if (guard.getSnapshot()) throw new Error(expiredMessage);
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            return result;
        } finally {
            unregister();
            init.signal?.removeEventListener('abort', abort);
        }
    };
}
export const api = createApiClient(sessionGuard);
export type Qualification = {
    id: string;
    code: string;
    rank: string;
    active: boolean;
    ballLabel: string;
};
export type AwardStatus = 'PENDING' | 'CALCULATED' | 'PENDING45D' | 'EFFECTIVE' | 'PAYABLE' | 'PAID' | 'REVERSED' | 'CLAWBACK';
export type Dashboard = {
    memberName: string;
    memberNo: string;
    qualification: Qualification;
    monthlyRepurchaseStatus: 'ACTIVE' | 'PENDING' | 'INACTIVE';
    pv: number | null;
    rpv: number | null;
    epv: number | null;
    bonusAmount: number | null;
    bonusStatus: AwardStatus;
};
export type Scoped = {
    qualificationId: string;
};
export type Person = {
    name: string;
    memberNo: string;
    email: string | null;
    phone: string | null;
};
export type Organization = Scoped & {
    sponsor: {
        code: string;
        name: string;
    } | null;
    referrals: {
        code: string;
        name: string;
    }[];
};
export type Binary = Scoped & {
    left: {
        count: number | null;
        volume: number | null;
    };
    right: {
        count: number | null;
        volume: number | null;
    };
};
export type Performance = Scoped & {
    period: string;
    pv: number | null;
    rpv: number | null;
    epv: number | null;
    left: number | null;
    right: number | null;
    asOf: string | null;
};
export type Award = {
    id: string;
    name: string;
    status: AwardStatus;
    amount: number | null;
};
export type Bonus = Scoped & {
    period: string;
    awards: Award[];
};
export type Ledger = Scoped & {
    period: string;
    entries: {
        id: string;
        label: string;
        amount: number | null;
        postedAt: string;
        sourceId: string;
    }[];
};
export type Product = {
    id: string;
    name: string;
    price: number | null;
    pv: number | null;
    available: boolean;
};
export type Order = {
    id: string;
    createdAt: string;
    total: number | null;
    status: string;
    paymentStatus: string;
    shipmentStatus: string;
};
export type Orders = Scoped & {
    orders: Order[];
};
