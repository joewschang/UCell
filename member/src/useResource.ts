import { useEffect, useState } from 'react';
/** Keyed state prevents previous qualification/period data flashing before effects run. */
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, enabled = true, keepDataOnReload = false) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{
        key: string;
        data?: T;
        error?: string;
        errorCause?: unknown;
    }>({ key: '' });
    useEffect(() => {
        if (!enabled) {
            setState({ key });
            return;
        }
        const controller = new AbortController();
        setState(previous => keepDataOnReload && previous.key === key && previous.data ? {...previous,error:undefined,errorCause:undefined} : { key });
        load(controller.signal).then(data => {
            if (!controller.signal.aborted)
                setState({ key, data });
        }).catch(error => {
            if (!controller.signal.aborted)
                setState(previous => ({key, ...(keepDataOnReload && previous.key === key ? {data:previous.data}:{}),error:error instanceof Error ? error.message : '資料讀取失敗',errorCause:error}));
        });
        return () => controller.abort();
    }, [key, attempt, enabled]); // Callers encode all request inputs in key.
    return { ...(state.key === key ? state : { key }), retry: () => setAttempt(n => n + 1) };
}
