import { sessionGuard, type SessionGuard } from './session';
const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const expiredMessage = '登入已失效，請重新登入';
export class MemberApiError extends Error { constructor(message:string,public readonly status:number,public readonly code?:string){super(message);this.name='MemberApiError';} }
export const REQUEST_TIMEOUT_MS = 15_000;
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
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
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
                let code:string|undefined;try{const body=await res.json();if(typeof body?.code==='string')code=body.code;}catch{/* Status still fails closed for a non-JSON error. */}
                throw new MemberApiError(res.status === 401 ? expiredMessage :
                    res.status === 403 ? '您無權查看此資格資料' :
                    res.status === 409 ? (code==='IDEMPOTENCY_CONFLICT'?'請求識別碼已被不同內容使用，請重新確認資料':'另一筆操作正在處理，請保留原資料重試') :
                    res.status === 422 ? (code==='RULE_PROFILE_CONFIGURATION_PENDING'?'商品制度設定尚未完成，請稍後再試':'資料未通過驗證或必要設定尚未完成，請確認後重試') :
                    res.status === 400 ? '資料格式不正確，請檢查輸入內容' : '資料暫時無法讀取，請稍後重試',res.status,code);
            }
            let result: T;
            try { result = await res.json() as T; }
            catch { throw new Error('資料格式異常，請稍後重試'); }
            if (guard.getSnapshot()) throw new Error(expiredMessage);
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
            return result;
        } catch (error) {
            // Session expiry and caller cancellation take precedence over timeout.
            if (guard.getSnapshot()) throw new Error(expiredMessage);
            if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
            if (timedOut) throw new Error('連線逾時，請檢查網路後重新載入');
            throw error;
        } finally {
            clearTimeout(timer);
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
    monthReference?: string;
    activeInterval?: { activeFrom: string; activeTo: string } | null;
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
    monthReference?: string;
    activeInterval?: { activeFrom: string; activeTo: string } | null;
};
export type Scoped = {
    qualificationId: string;
};
export type Person = {
    name: string;
    alias: string | null;
    memberNo: string;
    email: string | null;
    phone: string | null;
    gender: string | null;
    birthDate: string | null;
    membershipState: 'NETWORK_MEMBER' | 'FORMAL_PENDING' | 'FORMAL_MEMBER' | null;
    mobileVerifiedAt: string | null;
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
    theoryAmount?: number | null;
    finalAmount?: number | null;
    payableAmount?: number | null;
    settlementStatus?: 'PENDING' | 'FINALIZED';
    pendingReason?: string | null;
    settlementDate?: string | null;
    nominalPayoutDate?: string | null;
    adjustedPayoutDate?: string | null;
    businessCalendarVersion?: string | null;
    ruleVersion?: string | null;
    parameterSnapshotHash?: string | null;
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
