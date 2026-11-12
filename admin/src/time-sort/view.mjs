import {timeLabel,timeValues,sortRendered} from './chronology.mjs';
import {renderMeta,rawRecord,mapList,pageSource,pageFamily,collectPages} from './pages.mjs';

const fields = {
  accountingDate:'入帳日期',acknowledgedAt:'確認時間',activatedAt:'生效時間',activeFrom:'有效起日',activeTo:'有效迄日',
  adjustedPayoutDate:'調整後發放日期',approvedAt:'核准時間',attendedAt:'出席時間',availableAt:'可用時間',birthDate:'出生日期',
  boundAt:'綁定時間',cancelledAt:'取消時間',checkedAt:'檢查時間',checkedInAt:'報到時間',closedAt:'結案時間',cohortMonth:'加入月份',
  completedAt:'完成時間',confirmedAt:'確認時間',createdAt:'建立時間',dueAt:'截止時間',effectiveAt:'生效時間',effectiveFrom:'生效時間',
  effectiveTo:'有效迄日',eligibleAt:'符合資格時間',endAt:'結束時間',endMonth:'結束月份',endsAt:'結束時間',enteredAt:'進入時間',
  executedAt:'執行時間',expiresAt:'到期時間',fulfilledAt:'出貨時間',generatedAt:'產生時間',greetingDate:'問候日期',issuedAt:'開立時間',
  joinedAt:'加入時間',lastLoginAt:'上次登入',lastSuccessAt:'最近成功時間',leftMonth:'左區月份',maturesAt:'屆滿時間',
  nextAttemptAt:'下次嘗試時間',nominalPayoutDate:'原定發放日期',observationMonth:'觀察月份',observedAt:'觀察時間',
  occurredAt:'發生時間',oldestAt:'最早時間',oldestDueReceivedAt:'最早逾期收件時間',paidAt:'付款時間',pendingUntil:'待處理期限',
  placedAt:'完成時間',postedAt:'過帳時間',processedAt:'處理時間',projectedAt:'預估時間',publishAt:'發布時間',publishedAt:'發布時間',
  publishFrom:'發布起日',publishTo:'發布迄日',queuedAt:'排入時間',readAt:'已讀時間',receivedAt:'收件時間',recognitionMonth:'認列月份',
  recognizedAt:'認列時間',reconciledAt:'核帳時間',recordedAt:'記錄時間',redeemedAt:'兌換時間',registeredAt:'登記時間',
  reportedAt:'回報時間',requestedAt:'申請時間',reservedAt:'保留時間',reviewedAt:'審核時間',rightMonth:'右區月份',salesFrom:'銷售起日',
  salesTo:'銷售迄日',scheduledAt:'預定時間',sentAt:'發送時間',settledAt:'結算時間',settlementDate:'結算日期',snapshotExpiresAt:'快照到期時間',
  startAt:'開始時間',startedAt:'開始時間',startMonth:'開始月份',startsAt:'開始時間',submittedAt:'送件時間',updatedAt:'更新時間',
  uploadedAt:'上傳時間',verifiedAt:'驗證時間',since:'起始時間',until:'截止時間',asOf:'資料時間',at:'時間'
};
const canonicalField=key=>key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());
function cardFieldName(key) {
  const field=canonicalField(key);
  if(fields[field])return fields[field];
  if(/Month$/.test(field))return '月份';
  if(/(?:Since|From)$/.test(field))return '起始時間';
  if(/(?:Until|To)$/.test(field))return '截止時間';
  if(/Date$/.test(field))return '日期';
  if(/At$/.test(field))return '時間';
}
function declaredCardFields(node,found) {
  if(Array.isArray(node)){for(const item of node)declaredCardFields(item,found);return;}
  if(!node?.props)return;
  const key=node.props['data-time-field'];
  if(key)found.set(key,cardFieldName(key) || '日期');
  else declaredCardFields(node.props.children,found);
}
function textOf(node) {
  if(node==null||typeof node==='boolean')return '';
  if(Array.isArray(node))return node.map(textOf).join(' ');
  if(typeof node!=='object')return String(node);
  return textOf(node.props?.dateTime ?? node.props?.children);
}
function flat(nodes){return (Array.isArray(nodes)?nodes.flat(Infinity):[nodes]).filter(v=>v!=null && typeof v!=='boolean');}
function columnOptions(label,cells) {
  if(!timeLabel(label) && !cells.some(c=>timeValues(textOf(c)).length))return [];
  if(/時間與處理原因/.test(label))return [{label:'建立',index:0},{label:'接受',index:1}];
  if(/起始.*截止|起訖|顯示期間|有效期間|有效時間|開始.*結束|起日.*迄日/.test(label))
    return [{label:/起始|截止/.test(label)?'起始':'開始',index:0},{label:/起始|截止/.test(label)?'截止':'結束',index:1}];
  return [{label,index:0}];
}
function cellTime(cell,part,separate) {
  if(!separate)return timeValues(textOf(cell))[part];
  const children=flat(cell?.props?.children);
  if(children.some(c=>c?.type==='br')) {
    const groups=[[]];
    for(const child of children)if(child?.type==='br')groups.push([]);else groups.at(-1).push(child);
    if(groups.length>1)return timeValues(textOf(groups[part]))[0];
  }
  const segments=textOf(cell).split(/\s(?:至|～|~|–)\s/);
  return segments.length>1 ? timeValues(segments[part])[0] : timeValues(textOf(cell))[part];
}
function dateField(label,part) {
  const hints=[
    [/時間與處理原因/,part?'sentAt':'createdAt'],[/等待起始|等待時間/,part?'dueAt':'requestedAt'],[/截止|到期/,'dueAt'],[/完成|安置/,'placedAt'],
    [/待處理起點/,'since'],[/收件/,'receivedAt'],[/更新/,'updatedAt'],[/建立/,'createdAt'],[/核准|審核/,'reviewedAt'],
    [/綁定/,'boundAt'],[/發送/,'sentAt'],[/報到/,'checkedInAt'],[/付款/,'paidAt'],[/送件|提交/,'submittedAt'],
    [/有效時間|有效期間|起訖/,part?'effectiveTo':'effectiveFrom'],[/快照/,'asOf'],[/加入/,'joinedAt']
  ];
  return hints.find(([pattern])=>pattern.test(label))?.[1];
}
function precise(row,label,part,shown) {
  const raw=rawRecord(row);
  if(!raw)return shown;
  const preferred=dateField(label,part), actual=preferred&&timeValues(raw[preferred]??raw[preferred.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())])[0];
  if(actual!=null && shown!=null && Math.abs(actual-shown)<86400000)return actual;
  if(shown==null)return shown;
  const matches=Object.entries(raw).filter(([key,value])=>typeof value==='string' && cardFieldName(key))
      .map(([,value])=>timeValues(value)[0]).filter(actual=>actual!=null&&Math.abs(actual-shown)<60000);
  return matches.length===1?matches[0]:shown;
}
export function createViews(R) {
  const h=R.createElement, remembered=new Map();
  let lastPath='';
  function useListSort(identity) {
    const route=globalThis.location?.pathname || '';
    if(route!==lastPath){remembered.clear();lastPath=route;}
    const [,refresh]=R.useReducer(n=>n+1,0);
    const key=route+'|'+identity;
    return [remembered.get(key)??null,update=>{const value=typeof update==='function'?update(remembered.get(key)??null):update;remembered.set(key,value);refresh();}];
  }
  function useDataset(metadata,active) {
    const ref=pageSource(metadata), family=pageFamily(ref);
    const [result,setResult]=R.useState(null);
    // A new reference signifies paging, filter changes, or a fresh API read.
    R.useEffect(()=>{
      if(!active||!ref){setResult(null);return;}
      const controller=new AbortController();
      collectPages(ref,controller.signal).then(data=>{
        if(!controller.signal.aborted)setResult({ref,data});
      }).catch(error=>{if(!controller.signal.aborted)setResult({ref,error:error.message || '無法讀取完整清單。'});});
      return ()=>controller.abort();
    },[ref,active]);
    const current=active&&ref===result?.ref?result:null;
    return {ref,family,data:current?.data,error:current?.error,pending:!!(active&&ref&&!current)};
  }
  function status(view,tag='span'){
    if(!view.pending&&!view.error)return null;
    return h(tag,{role:view.error?'alert':'status',className:'admin-time-sort-status'},view.error?'完整清單讀取失敗，請重新點選排序。':'正在讀取符合篩選的全部資料…');
  }
  function button(label,id,sort,choose) {
    const selected=sort?.id===id;
    return h('button',{type:'button',className:'admin-time-sort-button',key:id,
      'aria-pressed':selected,'aria-label':label+'，'+(selected&&!sort.desc?'切換為降冪':'切換為升冪'),
      onClick:event=>{event.stopPropagation();choose(id);}},label,
      h('span',{'aria-hidden':true},selected?(sort.desc?'↓':'↑'):'↕'));
  }
  function nextSort(old,id){return {id,desc:old?.id===id&&!old.desc};}
  function displayRows(initial,meta,remote,sort,read) {
    if(!sort||remote.pending||remote.error)return initial;
    const data=remote.data;
    const rows=data ? mapList(data.all,meta.mapper) : initial;
    const ordered=sortRendered(rows,read,sort.desc);
    return data?ordered.slice(data.offset,data.offset+data.size):ordered;
  }
  function TimeTable({original}) {
    const sections=flat(original.children),thead=sections.find(x=>x?.type==='thead'),tbody=sections.find(x=>x?.type==='tbody');
    const header=flat(thead?.props.children).find(r=>r?.type==='tr');
    const labels=flat(header?.props.children);
    const meta=renderMeta(tbody?.props.children);
    const rows=flat(tbody?.props.children);
    const [sort,setSort]=useListSort(pageFamily(pageSource(meta))+'|'+labels.map(textOf).join('|'));
    const [retry,setRetry]=R.useState(0);
    const remote=useDataset(meta,sort&&sort.id+'-'+sort.desc+'-'+retry);
    const options=labels.map((th,i)=>columnOptions(textOf(th),rows.slice(0,8).map(row=>flat(row?.props?.children)[i])));
    const choose=id=>{setSort(old=>nextSort(old,id));setRetry(v=>v+1);};
    const chosen=sort?.id.split('-').map(Number);
    const ordered=displayRows(rows,meta,remote,chosen&&options[chosen[0]]?.length?sort:null,
      row=>precise(row,textOf(labels[chosen[0]]),chosen[1],cellTime(flat(row?.props?.children)[chosen[0]],chosen[1],options[chosen[0]].length>1)));
    const newHeads=labels.map((th,i)=>{
      if(!options[i].length||!R.isValidElement(th)||th.props['aria-sort']!==undefined||flat(th.props.children).some(x=>x?.type==='button'))return th;
      const controls=options[i].map(opt=>button(opt.label,i+'-'+opt.index,sort,choose));
      return R.cloneElement(th,{key:th.key??i,scope:'col','aria-sort':chosen?.[0]===i?(sort.desc?'descending':'ascending'):'none'},
        controls.length===1?controls:[h('span',{className:'admin-time-sort-group',key:'group'},textOf(th)),...controls]);
    });
    const sectionsNew=sections.map((node,i)=>{
      if(node===thead)return R.cloneElement(thead,{key:'head'},R.cloneElement(header,{},newHeads));
      if(node===tbody)return R.cloneElement(tbody,{key:'body'},ordered);
      return R.isValidElement(node)?R.cloneElement(node,{key:node.key??i}):node;
    });
    return h(R.Fragment,null,status(remote),h('table',original,...sectionsNew));
  }
  function cardFields(meta,rows) {
    const found=new Map();
    for(const row of rows.slice(0,12))declaredCardFields(row,found);
    if(found.size)return [...found];
    for(let i=0;i<rows.length;i++){
      const visible=timeValues(textOf(rows[i]));
      if(!visible.length)continue;
      for(const [key,value] of Object.entries(meta.source[i] || {})){
        const label=cardFieldName(key);
        if(typeof value!=='string'||!label)continue;
        const time=timeValues(value)[0];if(time==null)continue;
        if(visible.some(v=>Math.abs(v-time)<60000 || (v+28800000)%86400000===0&&Math.floor((v+28800000)/86400000)===Math.floor((time+28800000)/86400000)))
          found.set(key,label);
      }
    }
    const count=found.size?0:Math.max(0,...rows.map(r=>timeValues(textOf(r)).length));
    if(count)return Array.from({length:count},(_,i)=>['#'+i,count===1?'時間':'第'+(i+1)+'個日期']);
    const labels=[...found.values()];
    return [...found].map(([key,label])=>[key,labels.filter(l=>l===label).length===1?label:label+' '+(labels.slice(0,[...found.keys()].indexOf(key)+1).filter(l=>l===label).length)]);
  }
  function CardRows({list,container}) {
    const meta=renderMeta(list),options=cardFields(meta,list),[sort,setSort]=useListSort(pageFamily(pageSource(meta))+'|cards|'+options.map(o=>o[0]).join(',')+'|'+list[0]?.props?.className);
    const remote=useDataset(meta,sort ? sort.id+'-'+sort.desc : false);
    const active=sort&&options.some(([id])=>id===sort.id);
    const raw=remote.data?.all??meta.source;
    const pairs=raw.map((record,i)=>({record,row:remote.data?meta.mapper(record,i,raw):list[i]}));
    const sorted=active&&!remote.pending&&!remote.error?sortRendered(pairs,p=>sort.id.startsWith('#')?timeValues(textOf(p.row))[Number(sort.id.slice(1))]:timeValues(p.record[sort.id])[0],sort.desc):pairs;
    const rows=(remote.data?sorted.slice(remote.data.offset,remote.data.offset+remote.data.size):sorted).map(x=>x.row);
    if(!options.length)return list;
    const ctl=h(container==='ul'||container==='ol'?'li':'div',{className:'admin-time-sort-tools',role:'group','aria-label':'依日期排序'},
      ...options.map(([id,label])=>button(label,id,sort,id=>setSort(v=>nextSort(v,id)))),status(remote));
    return h(R.Fragment,null,ctl,rows);
  }
  function cardGroup(children,container){
    const meta=renderMeta(children);
    if(meta && children.some(v=>R.isValidElement(v)&&(['article','li','details'].includes(v.type)|| ['section','div','button'].includes(v.type)&&
      (v.key!=null&&(/list|row|item|card|record|entry|task|parcel|order|history|event/i.test(v.props.className||'')||['ul','ol'].includes(container)))))){
      if(cardFields(meta,children).length)return h(CardRows,{list:children,container,key:'date-rows-'+String(container)});
    }
    return children;
  }
  function wrap(factory) {
    return function(type,props,...rest){
      if(type==='table' && props && flat(props.children).some(x=>x?.type==='thead')) {
        const sections=flat(props.children),head=flat(sections.find(x=>x?.type==='thead')?.props.children)[0];
        const labels=flat(head?.props?.children),body=sections.find(x=>x?.type==='tbody');
        // Keep already interactive data grids and complex multirow/spanning headers intact.
        if(head && body && !labels.some(th=>th?.props?.['aria-sort']!==undefined||th?.props?.colSpan>1) &&
           flat(sections.find(x=>x?.type==='thead')?.props.children).length===1 &&
           (labels.some(th=>timeLabel(textOf(th))) || flat(body.props.children).slice(0,6).some(r=>timeValues(textOf(r)).length))) {
          return factory(TimeTable,{original:props},...rest);
        }
      }
      if((['div','ul','ol','section','article','main'].includes(type)||type===R.Fragment) && Array.isArray(props?.children)){
        let children=cardGroup(props.children,type);
        if(children===props.children&&children.some(Array.isArray))children=children.map(c=>Array.isArray(c)?cardGroup(c,type):c);
        if(children!==props.children)return factory(type,{...props,children},...rest);
      }
      return factory(type,props,...rest);
    };
  }
  function useGridOrder(rows,columns,sort,term,normalize,timeSource,adaptTimeRow) {
    const column=columns.find(c=>c.key===sort?.key);
    const dates=column && (timeLabel(column.label)||rows.slice(0,8).some(r=>timeValues(column.value(r)).length));
    const remote=useDataset(timeSource,dates ? sort.key+'-'+sort.descending : false);
    const input=remote.data && adaptTimeRow ? mapList(remote.data.all,timeSource.mapper).map(adaptTimeRow) : rows;
    const matches=term?input.filter(r=>columns.some(c=>normalize(c.value(r)).includes(term))):input;
    let ordered=matches;
    if(dates && !remote.pending && !remote.error)ordered=sortRendered(matches,r=>precise(r.row,column.label,sort.part??0,r.cells?.[Number(column.key)] ? cellTime(r.cells[Number(column.key)],sort.part??0,columnOptions(column.label,[]).length>1) : timeValues(column.value(r))[sort.part??0]),sort.descending);
    else if(column && !dates)ordered=[...matches].sort((a,b)=>column.value(a).localeCompare(column.value(b),'zh-TW',{numeric:true})*(sort.descending?-1:1));
    if(remote.data)ordered=ordered.slice(remote.data.offset,remote.data.offset+remote.data.size);
    return {ordered,remote};
  }
  function gridHeader(column,sort,setSort,reset,ordinary){
    const options=columnOptions(column.label,[]);
    if(options.length<2)return ordinary;
    const active=sort?.key===column.key?{id:String(sort.part??0),desc:sort.descending}:null;
    return h(R.Fragment,null,h('span',{className:'admin-time-sort-group'},column.label),...options.map(opt=>button(opt.label,String(opt.index),active,id=>{
      setSort({key:column.key,part:Number(id),descending:active?.id===id&&!active.desc});reset();
    })));
  }
  return {wrap,useGridOrder,useListSort,gridHeader,columnOptions,button};
}
