function TreeRootPicker({value, onChange, geo=false}) {
  const [keyword, setKeyword] = f.useState('');
  const [search, setSearch] = f.useState('');
  const [page, setPage] = f.useState(1);
  const pending = keyword.trim() !== search;
  f.useEffect(() => {
    const timer = setTimeout(() => {setPage(1); setSearch(keyword.trim());}, 220);
    return () => clearTimeout(timer);
  }, [keyword]);
  const result = Le({
    queryKey: [geo ? 'geo-root-directory' : 'tree-root-directory', search, page],
    queryFn: ({signal}) => le((geo ? '/admin/organization/geo/roots' : '/admin/observability/organization/tree-roots') + ze({q:search,page}), {signal}),
    retry:false, enabled:!pending,
  });
  const rows = pending ? [] : result.data?.data ?? [];
  return <section className="tree-root-picker" aria-label="選擇根球">
    <label className="field"><span>搜尋根球</span>
      <input type="search" maxLength={100} value={keyword} placeholder="輸入姓名、手機或球號"
        onChange={event => setKeyword(event.target.value)}/>
    </label>
    <div className="tree-root-heading"><strong>{search ? '搜尋結果' : geo ? '已安置球號' : '全部球號'}</strong><small>依加入時間，由早到晚</small></div>
    {pending || result.isLoading ? <p role="status">載入球清單中…</p>
      : result.isError ? <p role="alert">無法載入球清單。 <button type="button" onClick={() => result.refetch()}>重試</button></p>
      : rows.length === 0 ? <p role="status">{search ? '找不到符合的球，請換個姓名、手機或球號。' : '目前沒有可選的球。'}</p>
      : <ul>{rows.map(row => <li key={row.id}><button type="button" aria-pressed={row.id === value?.id || row.ballNo === value?.primary}
        onClick={() => onChange({id:row.id,primary:row.ballNo,secondary:row.name})}>
        <span><strong>{row.name}</strong><span>{row.ballNo}</span></span>
        {(row.id === value?.id || row.ballNo === value?.primary) && <small>已選取</small>}
      </button></li>)}</ul>}
    <div className="tree-root-pages">
      <button type="button" disabled={pending || page === 1} onClick={() => setPage(page-1)}>上一頁</button>
      <span aria-live="polite">第 {page} 頁</span>
      <button type="button" disabled={pending || !result.data?.meta?.hasNext} onClick={() => setPage(page+1)}>下一頁</button>
    </div>
  </section>;
}
