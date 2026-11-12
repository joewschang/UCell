import {timeViews} from '../time-sort/runtime.mjs';
import type {ListMeta} from '../time-sort/pages.mjs';
import { uiText, uiValue } from '../../../shared/design-system/i18n';
import { useState, type ReactNode } from 'react';
import { UCellButton, EmptyState, FilterBar } from '@ucell/design-system';
import './admin-data-grid.css';

export type GridColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string;
  render?: (row: T) => ReactNode;
};
type GridProps<T> = {
  rows: T[];
  timeSource?: ListMeta;
  adaptTimeRow?: (row:any,index:number)=>T;
  columns: GridColumn<T>[];
  rowId: (row: T) => string;
  label: string;
  toolbar?: ReactNode;
  searchable?: boolean;
  rowProps?: (row: T) => { onClick?: () => void; className?: string };
};

export function AdminDataGrid<T>({ rows, columns, rowId, label, toolbar, searchable = false, rowProps, timeSource, adaptTimeRow }: GridProps<T>) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = timeViews.useListSort<{ key: string; descending: boolean; part?:number }>(label);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<string[]>([]);
  const pageSize = 20;
  const normalize = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase();
  const term = normalize(search);
  const {ordered,remote:timePage} = timeViews.useGridOrder<T>(rows, columns, sort, term, normalize, timeSource, adaptTimeRow);
  const filtered=ordered;
  const visible = columns.filter(column => !hidden.includes(column.key));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(0);
  }
  function toggleColumn(key: string) {
    setHidden(previous => previous.includes(key) ? previous.filter(item => item !== key)
      : previous.length < columns.length - 1 ? [...previous, key] : previous);
  }

  return <section className="ops-data-grid" aria-label={label}>
    {searchable && <FilterBar><label>搜尋已載入資料
      <input type="search" value={search} onChange={event => changeSearch(event.target.value)}/>
    </label>{search && <UCellButton onClick={() => changeSearch('')}>清除搜尋</UCellButton>}</FilterBar>}
    {toolbar && <FilterBar>{toolbar}</FilterBar>}
    <div className="ops-grid-tools">
      {timePage.pending && <span role="status">正在讀取符合篩選的全部資料…</span>}
      {timePage.error && <span role="alert">完整清單讀取失敗，請重新排序。</span>}
      <span role="status">{term ? `符合 ${filtered.length} 筆，共載入 ${rows.length} 筆` : `本次載入 ${rows.length} 筆`}</span>
      <details><summary>顯示欄位</summary>
        <div className="ops-grid-columns">{columns.map(column =>
          <label key={column.key} className="checkbox">
            <input type="checkbox" checked={!hidden.includes(column.key)}
              disabled={visible.length === 1 && visible[0].key === column.key}
              onChange={() => toggleColumn(column.key)}/>{uiValue(column.label)}
          </label>)}</div>
      </details>
    </div>
    {!filtered.length ? <EmptyState title={term && rows.length ? '找不到符合搜尋的資料' : '目前沒有資料'}/> :
      <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
        <table><caption className="uc-sr-only">{uiValue(label)}{uiText('；僅對本次 API 回傳資料排序與分頁')}</caption>
          <thead><tr>{visible.map(column => <th scope="col" key={column.key}
            aria-sort={sort?.key === column.key ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
            {timeViews.gridHeader(column,sort,setSort,()=>setPage(0),<UCellButton onClick={() => {
              setSort({key:column.key, descending:sort?.key === column.key && !sort.descending});
              setPage(0);
            }}>{uiValue(column.label)}</UCellButton>)}
          </th>)}</tr></thead>
          <tbody>{ordered.slice(current * pageSize, (current + 1) * pageSize).map(row =>
            <tr key={rowId(row)} {...rowProps?.(row)}>{visible.map(column =>
              <td key={column.key}>{column.render ? column.render(row) : column.value(row)}</td>)}</tr>)}</tbody>
        </table>
      </div>}
    {filtered.length > pageSize && <div className="button-row ops-grid-pages">
      <UCellButton disabled={current === 0} onClick={() => setPage(current - 1)}>上一頁</UCellButton>
      <span aria-live="polite">第 {current + 1}／{pages} 頁</span>
      <UCellButton disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>下一頁</UCellButton>
    </div>}
  </section>;
}
