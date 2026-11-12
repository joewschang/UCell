import {useEffect, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import {get, qs} from '../../lib/api';
import type {Qualification} from '../../types/domain';

const PAGE_SIZE = 8;
const narrowScreen = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches === true;
type DirectoryPage = {data: Qualification[]; meta: {page: number; take: number; hasNext: boolean; total?: number}};

function focusOn(id: string) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => document.getElementById(id)?.focus());
}

export function useBallDirectory() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('qualificationId');
  const [open, setOpen] = useState(() => !selected || !narrowScreen());
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCoverage, setShowCoverage] = useState(false);
  useEffect(() => {
    const next = draft.trim();
    if (next === search) return;
    const timer = setTimeout(() => {setPage(1); setSearch(next);}, 240);
    return () => clearTimeout(timer);
  }, [draft, search]);

  const query = useQuery({
    queryKey: ['qualifications', 'directory', search, status, page],
    queryFn: ({signal}) => get<DirectoryPage>('/admin/qualifications' + qs({q: search, status: status || undefined, page, take: PAGE_SIZE}), {signal}),
  });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const busy = query.isPending || draft.trim() !== search;
  function filterStatus(value: string) {
    setPage(1);
    setStatus(value);
  }
  function clear() {
    setPage(1); setDraft(''); setSearch(''); setStatus('');
  }
  function select(id: string) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set('qualificationId', id); return next; }, {replace: true, preventScrollReset: true});
    if (narrowScreen()) setOpen(false);
    focusOn('ball-detail');
  }
  function toggle() {
    setOpen(!open);
    if (!open) focusOn('qualification-picker-title');
  }
  return {selected, open, toggle, showCoverage, setShowCoverage, draft, setDraft, status, filterStatus, clear, page, setPage, select, rows, busy, query, meta};
}

type Directory = ReturnType<typeof useBallDirectory>;
type Props = {
  directory: Directory;
  holder: (row: Qualification) => string;
  facts: (row: Qualification) => ReactNode;
  coverage?: (row: Qualification) => ReactNode;
  children: ReactNode;
};
export function BallPicker({directory: d, holder, facts, coverage, children}: Props) {
  const start = (d.page - 1) * PAGE_SIZE + 1;
  const end = start + d.rows.length - 1;
  const hasFilter = !!(d.draft || d.status);
  return <div className="uc-qualification-picker">
    <button type="button" className="qp-switch" aria-controls="qualification-ball-list" aria-expanded={d.open} onClick={d.toggle}>
      <span aria-hidden="true">{d.open ? '▾' : '▸'}</span> {d.open ? '收合球清單' : d.selected ? '切換球位' : '展開球清單'}
    </button>
    <div className={'qp-layout' + (d.open ? ' qp-open' : '')}>
      <section id="qualification-ball-list" className="qp-directory" hidden={!d.open} aria-labelledby="qualification-picker-title">
        <h2 id="qualification-picker-title" tabIndex={-1}>選擇球位</h2>
        <div className="qp-search" role="search" aria-label="搜尋會員球">
          <label>搜尋球位<input type="search" value={d.draft} onChange={event => d.setDraft(event.target.value)}
            placeholder="球號、姓名、手機、會員編號或電子郵件"/></label>
          <div className="qp-filters"><label>資格狀態<select value={d.status} onChange={event => d.filterStatus(event.target.value)}>
            <option value="">全部狀態</option><option value="DRAFT">尚未啟用</option><option value="EFFECTIVE">已生效</option>
            <option value="SUSPENDED">已暫停</option><option value="CLOSED">已關閉</option>
          </select></label>{hasFilter && <button type="button" onClick={d.clear}>清除條件</button>}</div>
        </div>
        {coverage && <label className="qp-coverage-toggle"><input type="checkbox" checked={d.showCoverage} onChange={event => d.setShowCoverage(event.target.checked)}/> 顯示重銷效期</label>}
        <div aria-busy={d.busy} className="qp-results">
          {d.busy ? <p role="status">正在載入球清單…</p> : d.query.isError ? <p role="alert">球清單載入失敗。 <button type="button" onClick={() => void d.query.refetch()}>重試</button></p> :
            d.rows.length ? <ul aria-label="球位搜尋結果">{d.rows.map(row => <li key={row.qualificationId}>
              <button type="button" className="qp-row" aria-pressed={d.selected === row.qualificationId} aria-controls="ball-detail" onClick={() => d.select(row.qualificationId)}>
                <strong>{holder(row)}{d.selected === row.qualificationId && <small className="qp-chosen" aria-hidden="true">已選取</small>}</strong><span className="qp-number">{row.ballNo ?? '尚未編配球號'}</span>
                <span className="qp-facts">{facts(row)}</span>{d.showCoverage && coverage && <span className="qp-coverage">{coverage(row)}</span>}
              </button></li>)}</ul> : <p role="status">{d.page > 1 ? '本頁已無球位，請回上一頁。' : hasFilter ? '找不到符合條件的球位，請調整搜尋或狀態。' : '目前沒有可顯示的球位。'}</p>}
        </div>
        <nav className="qp-pages" aria-label="球清單分頁">
          <button type="button" disabled={d.page <= 1 || d.busy} onClick={() => d.setPage(d.page - 1)}>上一頁</button>
          <span aria-live="polite">第 {d.page} 頁{!d.busy && !d.query.isError && d.rows.length > 0 && <small>{start}–{end} 筆{d.meta?.total != null ? '／共 ' + d.meta.total + ' 筆' : ''}</small>}</span>
          <button type="button" disabled={d.busy || !d.meta?.hasNext} onClick={() => d.setPage(d.page + 1)}>下一頁</button>
        </nav>
      </section>
      <div className="qp-detail">{children}</div>
    </div>
  </div>;
}
