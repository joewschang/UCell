import { useEffect, useState } from 'react';
/** Keyed state prevents previous qualification/period data flashing before effects run. */
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{
        key: string;
        data?: T;
        error?: string;
    }>({ key: '' });
    useEffect(() => {
        const controller = new AbortController();
        setState({ key });
        load(controller.signal).then(data => {
            if (!controller.signal.aborted)
                setState({ key, data });
        }).catch(error => {
            if (!controller.signal.aborted)
                setState({ key, error: error instanceof Error ? error.message : '資料讀取失敗' });
        });
        return () => controller.abort();
    }, [key, attempt]); // Callers encode all request inputs in key.
    return { ...(state.key === key ? state : { key }), retry: () => setAttempt(n => n + 1) };
}
