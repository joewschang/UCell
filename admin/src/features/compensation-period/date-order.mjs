export function nextDateOrder(current, field) {
  return {field, descending:current?.field === field && !current.descending};
}

export function dateButton(order,field,label,change) {
  const active=order?.field === field;
  return {
    type:'button',className:'admin-time-sort-button','aria-pressed':active,
    'aria-label':label+'，切換為'+(active && !order.descending?'降冪':'升冪'),
    onClick:()=>change(nextDateOrder(order,field)),
    children:label+(active?(order.descending?' ↓':' ↑'):' ↕')
  };
}

export function orderedByDate(rows, order) {
  if (!order) return rows;
  function time(row) {
    const value = row[order.field] ?? row.evidence?.[order.field];
    const stamp = Date.parse(value);
    return Number.isFinite(stamp) ? stamp : null;
  }
  return rows.map(row=>({row,stamp:time(row)})).sort((a,b)=>{
    if (a.stamp==null) return b.stamp==null?0:1;
    if (b.stamp==null) return -1;
    return order.descending?b.stamp-a.stamp:a.stamp-b.stamp;
  }).map(item=>item.row);
}

// The verification API returns up to 25 items and hasMore without a total.
export async function readVerificationPages(read,page,all,signal) {
  if (!all) return read(page,signal);
  const items=[],keys=new Set();
  for (let current=1;;current++) {
    signal?.throwIfAborted();
    const response=await read(current,signal);
    const data=response.data;
    if (!Array.isArray(data?.items)) throw Error('無法讀取完整清單，請重試。');
    for (const row of data.items) {
      const key=row.key ?? row.id;
      if (!key || keys.has(key)) throw Error('清單已更新，請重新載入。');
      keys.add(key);
      items.push(row);
    }
    if (!data.hasMore) break;
    if (!data.items.length) throw Error('清單已更新，請重新載入。');
  }
  return {data:{items,hasMore:false}};
}

export function verificationPage(result, page, order) {
  if (!result || !order) return result;
  const items=orderedByDate(result.data.items,order);
  const start=(page-1)*25,end=start+25;
  return {data:{items:items.slice(start,end),hasMore:end<items.length}};
}
