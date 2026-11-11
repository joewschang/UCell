// Uses the production application's own router, authenticated GET and query cache.
function createOperationsWorkbench({ React, Link, useQuery, get, canOpen, useLocation, useNavigate }) {
  const h = React.createElement;
  const number = new Intl.NumberFormat('zh-TW');
  const taipei = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function count(value) {
    if (typeof value === 'string' && /^\d+$/.test(value)) value = Number(value);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  function timestamp(raw) {
    const date = new Date(raw);
    if (!raw || !Number.isFinite(date.valueOf())) return null;
    return h('time', {dateTime: date.toISOString()}, '台北時間 ' + taipei.format(date) + ' 更新');
  }

  function ranked(groups) {
    return groups.filter(group => count(group.count) > 0).sort((left, right) =>
      (count(right.overdue) ?? 0) - (count(left.overdue) ?? 0) ||
      count(right.count) - count(left.count)
    );
  }

  function useDailySelection(groups, requested) {
    const [initial, setInitial] = React.useState('');
    const preferred = groups.find(group => group.code === requested)?.code;
    const validInitial = groups.some(group => group.code === initial);
    const fallback = validInitial ? initial : ranked(groups)[0]?.code ?? groups[0]?.code ?? '';
    React.useEffect(() => {
      if (fallback && fallback !== initial) setInitial(fallback);
    }, [fallback, initial]);
    return preferred || fallback;
  }

  function useFilter(name, fallback = '') {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    let value = params.get(name) || fallback;
    if (name === 'segment' && !['ALL','CONNECT','REACH','START','CELEBRATE'].includes(value)) value = fallback;
    const update = next => {
      if (next && next !== fallback) params.set(name, next);
      else params.delete(name);
      const search = params.toString();
      navigate({ pathname: location.pathname, search: search ? '?' + search : '', hash: location.hash }, {replace: true});
    };
    return [value, update];
  }

  function link(to, label, extra = {}) {
    return h(Link, {to, ...extra}, label, h('span', {className: 'opsw-arrow', 'aria-hidden': true}, '→'));
  }

  function readState(query, label) {
    if (query.isError) return h('div', {className:'opsw-feedback', role:'status'},
      h('span', null, label + '讀取失敗。'), h('button', {type:'button', disabled:query.isFetching, onClick:() => query.refetch()}, '重新讀取'));
    if (!query.data) return h('p', {role:'status', className:'opsw-muted'}, '正在讀取' + label + '…');
    return null;
  }

  function Daily({role}) {
    const query = useQuery({
      queryKey:['daily-operations', role],
      queryFn:({signal}) => get('/admin/daily-operations', {signal}),
      refetchInterval:60_000, staleTime:30_000
    });
    const data = query.data?.data;
    const groups = Array.isArray(data?.groups) ? data.groups : null;
    const ready = groups && !query.isError;
    const priority = ready ? ranked(groups).slice(0, 3) : [];
    return h('section', {className:'opsw-panel', 'aria-labelledby':'opsw-daily-title'},
      h('header', {className:'opsw-head'}, h('h2', {id:'opsw-daily-title'}, '優先處理'), ready && timestamp(data.asOf)),
      readState(query, '待辦') ||
      (priority.length ? h(React.Fragment, null,
        h('p', {className:'opsw-muted'}, '依超過建議時限的件數排序，再看待辦件數。'),
        h('ul', {className:'opsw-queue'}, priority.map(group =>
          h('li', {key:group.code}, h(Link, {
            to:'/daily-operations?category=' + encodeURIComponent(group.code),
            className:'opsw-queue-link'
          }, h('span', {className:'opsw-queue-title'}, group.title,
              h('small', null, group.owner, group.hours != null ? ' · 建議 ' + group.hours + ' 小時內處理' : '')),
            h('span', {className:'opsw-queue-value'}, h('strong', null, number.format(count(group.count))), ' 件',
              count(group.overdue) > 0 && h('small', {className:'opsw-overdue'}, '逾時 ' + number.format(count(group.overdue)) + ' 件')),
            h('span', {className:'opsw-arrow', 'aria-hidden':true}, '→'))))))
        : h('p', {className:'opsw-empty'}, !ready ? '待辦摘要暫無資料。' : !groups.length ? '此角色目前沒有可查看的待辦類別。' :
          groups.every(group => count(group.count) === 0) ? '您可查看的類別目前都沒有待辦。' : '部分類別尚無可用件數。')),
      link('/daily-operations', '查看全部待辦', {className:'opsw-more'})
    );
  }

  const segments = {
    CONNECT:'查看已有造訪、尚無新註冊的球',
    REACH:'查看已分享、尚無造訪的球',
    START:'查看尚未建立分享連結的球'
  };

  function Marketing({role}) {
    const query = useQuery({
      queryKey:['ops-workbench-sharing', role],
      queryFn:async ({signal}) => {
        const result = await get('/admin/marketing?search=&segment=ALL&page=1', {signal});
        const data = result?.data;
        if (!data?.summary) throw new Error('分享摘要暫無資料');
        return {asOf:data.asOf, summary:data.summary, segments:data.segments};
      },
      staleTime:120_000, refetchInterval:300_000
    });
    const data = !query.isError && query.data;
    const focus = Object.keys(segments).find(segment => count(data?.segments?.[segment]) > 0);
    const metrics = [['links','分享連結'],['visitors','有效造訪'],['registrations','新註冊會員']];
    return h('section', {className:'opsw-panel', 'aria-labelledby':'opsw-growth-title'},
      h('header', {className:'opsw-head'}, h('h2', {id:'opsw-growth-title',tabIndex:-1}, '分享與註冊'), data && timestamp(data.asOf)),
      readState(query, '分享成效') ||
      h(React.Fragment, null,
        h('p', {className:'opsw-muted'}, '近 30 天建立的連結，累計至更新時間。有效造訪依瀏覽器去重。'),
        h('dl', {className:'opsw-stats'}, metrics.map(([key, label]) => {
          const value = count(data.summary[key]);
          return h('div', {key}, h('dt', null, label), h('dd', null, value === null ? '—' : number.format(value)));
        })),
        focus && link('/marketing?segment=' + focus, segments[focus] + '（' + number.format(count(data.segments[focus])) + '）',
          {className:'opsw-action'})),
      link('/marketing', '開啟分享行銷看板', {className:'opsw-more'})
    );
  }

  function Workbench({role}) {
    if (!role) return null;
    const daily = canOpen(role, '/daily-operations'), marketing = canOpen(role, '/marketing');
    if (!daily && !marketing) {
      const routes = [['/notification-hub','通知與成長中心'],['/faq','常見問答管理'],['/packages','套組與資格商品']];
      const links = routes.filter(([path]) => canOpen(role,path));
      if (!links.length) return null;
      return h('nav', {className:'opsw-shortcuts', 'aria-label':'角色常用作業'}, links.map(([path, label]) => link(path,label,{key:path})));
    }
    return h(React.Fragment, null,
      h('div', {className:'opsw-grid'}, daily && h(Daily, {role}), marketing && h(Marketing, {role})),
      canOpen(role,'/reports') && link('/reports','查看已付款與退貨報表',{className:'opsw-more'}));
  }

  return {Workbench, useFilter, useDailySelection};
}
