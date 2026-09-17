import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getQualifications,selectQualification } from './memberData';
import type { Qualification } from './api';
type State = {
    qualifications: Qualification[];
    current: Qualification | null;
    select: (id: string) => void;
    loading: boolean;
    loadingLabel: string;
    error: string | null;
    retry: () => void;
    feedback: string;
};
const Context = createContext<State | null>(null);
export function QualificationProvider({ children }: {
    children: ReactNode;
}) {
    const [items, setItems] = useState<Qualification[]>([]);
    const [id, setId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingLabel, setLoadingLabel] = useState('資格資料載入中…');
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [feedback,setFeedback]=useState('');
    const selection=useRef<{sequence:number;controller?:AbortController}>({sequence:0});
    useEffect(() => {
        let alive = true;
        const controller = new AbortController();
        setLoading(true);
        setLoadingLabel('資格資料載入中…');
        setError(null);
        setItems([]);
        setFeedback('');
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
        return () => { alive = false; controller.abort(); selection.current.sequence++;selection.current.controller?.abort(); };
    }, [attempt]);
    const select = async (next: string) => {
        const q=items.find(q=>q.id===next);
        if (!q)
            return;
        selection.current.controller?.abort();const controller=new AbortController();
        const sequence=++selection.current.sequence;selection.current.controller=controller;
        setLoading(true);setError(null);setId('');setFeedback('');
        setLoadingLabel(`正在確認 ${q.code}｜${q.ballLabel}，請稍候…`);
        try{
          const confirmed=await selectQualification(q,controller.signal);
          if(sequence!==selection.current.sequence||controller.signal.aborted)return;
          setItems(rows=>rows.map(row=>row.id===confirmed.id?confirmed:row));setId(confirmed.id);
          setFeedback(`已切換至 ${confirmed.code}｜${confirmed.ballLabel}`);
          try { sessionStorage.setItem('ucell_qualification_id', confirmed.id); } catch { /* Selection memory is optional. */ }
        }catch(error){if(sequence===selection.current.sequence&&!controller.signal.aborted)setError(error instanceof Error?error.message:'無法確認資格，請重新查詢');}
        finally{if(sequence===selection.current.sequence&&!controller.signal.aborted)setLoading(false);}
    };
    return <Context.Provider value={{ qualifications: items, current: items.find(q => q.id === id) ?? null, select, loading, loadingLabel, error, feedback, retry: () => setAttempt(a => a + 1) }}>{children}</Context.Provider>;
}
export function useQualification() { const value = useContext(Context); if (!value)
    throw new Error('QualificationProvider missing'); return value; }
