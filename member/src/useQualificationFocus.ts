import {useLayoutEffect, useRef} from 'react';

// Keep focus on the stable content region while the selector is unmounted.
// Do not take focus back if the member moves to navigation while waiting.
export function useQualificationFocus(loading: boolean, error: string | null, qualificationId?: string) {
  const mainRef = useRef<HTMLElement>(null);
  const restore = useRef(false);
  const begin = () => {
    if (!mainRef.current) return;
    restore.current = true;
    mainRef.current.focus();
  };
  useLayoutEffect(() => {
    if (loading || !restore.current) return;
    restore.current = false;
    const main = mainRef.current;
    if (!error && main && main.ownerDocument.activeElement === main) {
      main.querySelector<HTMLSelectElement>('#qualification')?.focus();
    }
  }, [loading, error, qualificationId]);
  return {mainRef, begin};
}
