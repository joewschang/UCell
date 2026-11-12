// Keep page provenance out of the domain objects used by React Query and form submissions.
const arrays = new WeakMap(), records = new WeakMap(), rendered = new WeakMap(), rawProps = new WeakMap();
export function mapList(source, mapper, optional = false) {
  if (optional && source == null) return undefined;
  const result = source.map(mapper);
  if (Array.isArray(source) && source.length && Array.isArray(result)) {
    rendered.set(result,{source,mapper});
    result.forEach((element,i)=>{if(element?.props && source[i] && typeof source[i]==='object')rawProps.set(element.props,source[i]);});
  }
  return result;
}
export const rawRecord = element => element?.props && rawProps.get(element.props);
export const renderMeta = list => list && rendered.get(list);
function atPath(data, keys) { return keys.reduce((v,k)=>v?.[k],data); }
function pageShape(envelope,path,url,items) {
  const data=envelope?.data, parent=atPath(envelope,path.slice(0,-1));
  const meta=[parent,data?.pagination,data?.meta,envelope?.meta].filter(v=>v && typeof v==='object' && !Array.isArray(v));
  const value=(...names)=>{ for(const obj of meta)for(const n of names)if(obj[n]!==undefined)return obj[n]; };
  const next=value('nextCursor','nextAfter','nextPageToken');
  const hasNext=value('hasNext','hasMore','hasNextPage');
  const pageParam=['page','pageNumber','pageIndex'].find(k=>url.searchParams.has(k)) || 'page';
  const page=Number(url.searchParams.get(pageParam) || value('page','pageNumber') || 1);
  const size=Number(value('pageSize','limit','take') || url.searchParams.get('pageSize') || url.searchParams.get('take') || url.searchParams.get('limit') || items.length);
  let total=value('total','totalCount','totalItems');
  if(typeof total!=='number' && typeof total!=='string')total=undefined;
  const cursorKey=url.pathname.endsWith('/qualification-placements/dashboard') ? 'after' : (['after','cursor','pageToken','before'].find(k=>url.searchParams.has(k)) || 'cursor');
  if (next!==undefined || url.searchParams.has(cursorKey))return {kind:'cursor',key:cursorKey,next,page,size};
  if (url.searchParams.has(pageParam) || hasNext!==undefined || value('totalPages')!==undefined || (total!==undefined && size>0 && Number(total)>items.length))
    return {kind:'page',key:pageParam,page,size,next:hasNext ?? (value('totalPages')!==undefined ? page<Number(value('totalPages')) : total!==undefined ? page*size<Number(total) : items.length>=size)};
  return null;
}
export function trackRead(path,envelope,read) {
  if(typeof path!=='string'||!envelope?.data||!path.startsWith('/admin/'))return envelope;
  const url=new URL(path,'https://query.invalid');
  function visit(value,keys,depth) {
    if(Array.isArray(value)) {
      if (!value.length||!value.every(row=>row && typeof row==='object' && !Array.isArray(row)))return;
      const page=pageShape(envelope,keys,url,value);
      if(!page)return;
      const source={url,keys,page,items:value,read};
      arrays.set(value,source);for(const row of value)records.set(row,source);
    } else if(depth<3&&value&&typeof value==='object') {
      for(const [k,v] of Object.entries(value)) if(k!=='meta'&&k!=='counts')visit(v,[...keys,k],depth+1);
    }
  }
  visit(envelope.data,['data'],0);return envelope;
}
export function pageSource(metadata) {
  const array=metadata?.source;
  if(!array?.length)return null;
  const match=arrays.get(array) || records.get(array[0]);
  // A filtered subset can have a different domain from the paginated collection.
  return match && match.items.length===array.length && (match.items===array || match.items.every((r,i)=>r===array[i])) ? match : null;
}
export function pageFamily(src){
  if(!src)return '';
  const u=new URL(src.url);u.searchParams.delete(src.page.key);u.searchParams.delete('asOf');u.searchParams.sort();
  return u.pathname+u.search+'#'+src.keys.join('.');
}
export async function collectPages(source,signal) {
  const all=[], visited=new Set(), u=new URL(source.url);
  const startCursor=u.searchParams.get(source.page.key);
  let offset=0, found=source.page.kind==='page'||!startCursor, page=1;
  u.searchParams.delete(source.page.key);
  if(source.page.kind==='page')u.searchParams.set(source.page.key,'1');
  for (;;) {
    signal.throwIfAborted();
    const address=u.pathname+u.search;
    if(visited.has(address))throw Error('分頁游標重複，請重新排序。');
    visited.add(address);
    const response=await source.read(address,{signal});
    const rows=atPath(response,source.keys);
    if(!Array.isArray(rows))throw Error('清單格式已變更，請重新整理。');
    if((source.page.kind==='cursor' && u.searchParams.get(source.page.key)===startCursor) || (source.page.kind==='page' && source.page.page===page)){offset=all.length;found=true;}
    // Only whole-page repetition signals a broken paginator; rows may legitimately share an order or qualification.
    const signature=JSON.stringify(rows);
    if(rows.length&&visited.has(signature))throw Error('資料集已更新，請重新排序。');
    visited.add(signature);
    all.push(...rows);
    const info=pageShape(response,source.keys,u,rows);
    if(!info?.next || !rows.length)break;
    if(info.kind==='cursor') {
      u.searchParams.set(info.key,String(info.next));
      const asOf=response?.data?.asOf;
      if(asOf && !u.searchParams.has('asOf'))u.searchParams.set('asOf',asOf);
    }else{
      u.searchParams.set(info.key,String(++page));
    }
  }

  if(!found)throw Error('清單已更新，請返回第一頁重新排序。');
  return {all,offset,size:source.items.length};
}
