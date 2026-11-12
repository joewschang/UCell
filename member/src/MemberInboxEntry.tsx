import {useLayoutEffect, type ReactNode, type RefObject} from 'react';
import {Link, useLocation} from 'react-router-dom';

export function useInboxRoute(main: RefObject<HTMLElement | null>) {
  const {pathname, key} = useLocation();
  const open = /^\/notifications\/?$/i.test(pathname);
  useLayoutEffect(() => {
    if (!open) return;
    main.current?.focus({preventScroll: true});
    if (main.current?.scrollTop) main.current.scrollTop = 0;
    if (window.scrollY) window.scrollTo(0, 0);
  }, [open, key, main]);
  return open;
}

export function InboxScope({loading, error, retry, children}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading || error) return <div className="uc-inbox-scope">
    <span role="status">{loading ? '正在查詢球號，先顯示個人通知。' : '暫時無法載入球號，先顯示個人通知。'}</span>
    {error && !loading && <button type="button" onClick={retry}>重新載入球號</button>}
  </div>;
  return <>{children}</>;
}

export function MeInboxLink() {
  return <Link className="uc-inbox-account-link" to="/notifications">查看通知中心 <span aria-hidden="true">→</span></Link>;
}
