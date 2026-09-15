import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getQualifications } from './memberData';
import type { Qualification } from './api';
type State = {
    qualifications: Qualification[];
    current: Qualification | null;
    select: (id: string) => void;
    loading: boolean;
    error: string | null;
    retry: () => void;
};
const Context = createContext<State | null>(null);
export function QualificationProvider({ children }: {
    children: ReactNode;
}) {
    const [items, setItems] = useState<Qualification[]>([]);
    const [id, setId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        setItems([]);
        getQualifications(controller.signal).then(q => {
            if (!alive)
                return;
            let saved: string | null = null;
            try { saved = sessionStorage.getItem('ucell_qualification_id'); } catch { /* Selection memory is optional. */ }
            const next = q.find(item => item.id === saved)?.id ?? q[0]?.id ?? '';
            setItems(q);
            setId(next);
            try { if (next)
                sessionStorage.setItem('ucell_qualification_id', next);
            else
                sessionStorage.removeItem('ucell_qualification_id');
            } catch { /* In-memory selection remains valid. */ }
        }).catch(() => { if (alive)
            setError('無法取得資格清單，請確認登入狀態後重試'); })
            .finally(() => { if (alive)
            setLoading(false); });
        return () => { alive = false; controller.abort(); };
    }, [attempt]);
    const select = (next: string) => {
        if (!items.some(q => q.id === next))
            return;
        setId(next);
        try { sessionStorage.setItem('ucell_qualification_id', next); } catch { /* In-memory selection remains valid. */ }
    };
    return <Context.Provider value={{ qualifications: items, current: items.find(q => q.id === id) ?? null, select, loading, error, retry: () => setAttempt(a => a + 1) }}>{children}</Context.Provider>;
}
export function useQualification() { const value = useContext(Context); if (!value)
    throw new Error('QualificationProvider missing'); return value; }
