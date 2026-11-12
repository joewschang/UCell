import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {DetailDrawer} from '@ucell/design-system';
import {get} from '../../lib/api';
import {cardWidth,cardHeight,sponsorForest,sponsorLayout,type SponsorBall,type SponsorNode} from './sponsor-map-layout';
import './sponsor-overview.css';

type Forest=ReturnType<typeof sponsorForest>;
type Layout=ReturnType<typeof sponsorLayout>;
type MapResponse={data:SponsorBall[];meta:{complete:boolean;total:number;asOf:string}};
type MapProps={selectedRootId?:string|null;selection?:unknown;renderBall360:(id:string)=>ReactNode};
type View={left:number;top:number;width:number;height:number};
const plans:Record<string,string>={STARTER:'啟航',ELITE:'菁英',LEADER:'領袖'};
const activity=(value:boolean|null)=>value===true?'活躍':value===false?'不活躍':'活躍狀態未提供';
const tone=(value:boolean|null)=>value===true?'on':value===false?'off':'unknown';
const display=(ball:SponsorBall)=>[ball.name||'姓名未提供',ball.ballNo||'球號未編配'].join(' · ');
const time=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});

function PlanMark({plan}:{plan:string|null}){
  return <svg aria-hidden="true" viewBox="0 0 32 30" className="sov-mark">{plan==='STARTER'?<circle cx="16" cy="15" r="11"/>:
    plan==='ELITE'?<rect x="5" y="4" width="22" height="22" rx="2"/>:plan==='LEADER'?<path d="M2 7l8 5 6-10 6 10 8-5-4 16H6zm5 18h18v3H7z"/>:<path d="M16 2l13 13-13 13L3 15z"/>}</svg>;
}

function Diagram({layout,forest,onSelect,focused}:{layout:Layout;forest:Forest;onSelect:(ball:SponsorBall)=>void;focused:boolean}) {
  const scroller=useRef<HTMLDivElement>(null),paper=useRef<HTMLDivElement>(null);
  const [view,setView]=useState<View>({left:0,top:0,width:640,height:400});
  const [zoom,setZoom]=useState<number|'fit'>(1);
  const center=useRef<{x:number;y:number}|null>(null),drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  const pendingFocus=useRef<string|null>(null);
  const frame=useRef(0);
  const fit=Math.min(1,Math.max(1,view.width-4)/layout.width,Math.max(1,view.height-4)/layout.height);
  const scale=zoom==='fit'?fit:zoom;
  function measure(){
    const el=scroller.current;if(!el)return;
    const next={width:el.clientWidth,height:el.clientHeight,left:el.scrollLeft,top:el.scrollTop};
    setView(old=>old.width===next.width&&old.height===next.height&&old.left===next.left&&old.top===next.top?old:next);
  }
  function scheduleMeasure(){
    if(frame.current)return;
    frame.current=requestAnimationFrame(()=>{frame.current=0;measure();});
  }
  useLayoutEffect(()=>{
    const el=scroller.current;if(!el)return;
    const observer=new ResizeObserver(measure);observer.observe(el);
    return ()=>{observer.disconnect();cancelAnimationFrame(frame.current);};
  },[]);
  useLayoutEffect(()=>{
    const el=scroller.current;if(!el)return;
    const first=layout.order[0];
    const target=zoom==='fit'?{x:layout.width/2,y:layout.height/2}:center.current;
    el.scrollLeft=(target?.x??(first.x+cardWidth/2))*scale-el.clientWidth/2;
    el.scrollTop=target?target.y*scale-el.clientHeight/2:0;
    measure();
  },[layout,scale,zoom]);
  function changeZoom(value:number|'fit'){
    const el=scroller.current;if(!el)return;
    center.current={x:Math.min(layout.width/2+(el.scrollLeft/scale), (el.scrollLeft+el.clientWidth/2)/scale),y:(el.scrollTop+el.clientHeight/2)/scale};
    setZoom(value);
  }
  const visible=useMemo(()=>{
    const left=view.left/scale-cardWidth, right=(view.left+view.width)/scale+cardWidth;
    const top=view.top/scale-cardHeight, bottom=(view.top+view.height)/scale+cardHeight;
    return layout.order.filter(n=>n.x+cardWidth>=left&&n.x<=right&&n.y+cardHeight>=top&&n.y<=bottom);
  },[layout,view,scale]);
  const compact=scale<.36 && visible.length>180;
  const dots=useMemo(()=>{
    const paths:Record<string,string[]>={on:[],off:[],unknown:[]};
    if(compact) for(const n of visible) paths[tone(n.ball.active)].push('M'+n.x+','+n.y+'h'+cardWidth+'v'+cardHeight+'h-'+cardWidth+'z');
    return paths;
  },[compact,visible]);
  useLayoutEffect(()=>{
    if(!pendingFocus.current)return;
    const btn=Array.from(paper.current?.querySelectorAll<HTMLButtonElement>('button[data-ball]')||[]).find(b=>b.dataset.ball===pendingFocus.current);
    if(btn){btn.focus({preventScroll:true});pendingFocus.current=null;}
  },[visible]);
  function focusAdjacent(n:SponsorNode,key:string){
    const parent=n.ball.parentId&&layout.positions.get(n.ball.parentId);
    const siblings=parent?forest.children.get(parent.ball.id)!:forest.roots;
    const index=siblings.findIndex(ball=>ball.id===n.ball.id);
    const target=key==='ArrowDown'?forest.children.get(n.ball.id)?.[0]:key==='ArrowUp'?parent&&parent.ball:
      key==='ArrowLeft'?siblings[index-1]:key==='ArrowRight'?siblings[index+1]:null;
    const pos=target&&layout.positions.get(target.id),el=scroller.current;
    if(!pos||!el)return;
    pendingFocus.current=pos.ball.id;el.scrollLeft=(pos.x+cardWidth/2)*scale-el.clientWidth/2;
    el.scrollTop=(pos.y+cardHeight/2)*scale-el.clientHeight/2;measure();
    const button=Array.from(paper.current?.querySelectorAll<HTMLButtonElement>('button[data-ball]')||[]).find(b=>b.dataset.ball===pos.ball.id);
    if(button){button.focus({preventScroll:true});pendingFocus.current=null;}
  }
  return <>
    <div className="sov-tools"><div className="sov-legend" aria-label="方案與活躍狀態">
      {Object.entries(plans).map(([key,label])=><span key={key}><PlanMark plan={key}/>{label}</span>)}
      <span className="sov-on">● 活躍</span><span className="sov-off">● 不活躍</span>{layout.order.some(n=>n.ball.active==null)&&<span>◇ 狀態未提供</span>}
    </div><div className="sov-zoom" role="group" aria-label="全貌縮放">
      <button type="button" aria-label="縮小" disabled={scale<=Math.min(.05,fit)} onClick={()=>changeZoom(Math.max(Math.min(.05,fit),scale/1.4))}>−</button>
      <button type="button" aria-label="還原為 100%" onClick={()=>changeZoom(1)}>{scale<.01?'＜1':Math.round(scale*100)}%</button>
      <button type="button" aria-label="放大" disabled={scale>=3} onClick={()=>changeZoom(Math.min(3,scale*1.4))}>＋</button>
      <button type="button" onClick={()=>changeZoom('fit')}>{focused?'顯示整個支系':'顯示全樹'}</button>
    </div></div>
    <p className="sov-note">{layout.order.length.toLocaleString('zh-TW')} 顆球 · {layout.rootCount} 個起點 · {layout.levels} 層。滑動或拖移空白處瀏覽，點選球查看 360。</p>
    <div className="sov-viewport" aria-label="可捲動的推薦樹" role="region" tabIndex={0} ref={scroller} onScroll={scheduleMeasure}
      onPointerDown={e=>{
        if(e.pointerType!=='mouse'||e.button!==0||(e.target as Element).closest('button,[data-minimap]'))return;
        drag.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};
        e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e=>{const d=drag.current;if(d){e.currentTarget.scrollLeft=d.left+d.x-e.clientX;e.currentTarget.scrollTop=d.top+d.y-e.clientY;}}}
      onLostPointerCapture={()=>{drag.current=null;}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <div className="sov-size" style={{width:layout.width*scale,height:layout.height*scale}}><div className="sov-paper" ref={paper} style={{width:layout.width,height:layout.height,transform:'scale('+scale+')'}}>
        <svg className="sov-wires" width={layout.width} height={layout.height} aria-hidden="true"><path d={layout.edges}/></svg>
        {compact?<svg className="sov-mini" width={layout.width} height={layout.height} aria-hidden="true" onClick={e=>{
          const rect=paper.current!.getBoundingClientRect(),x=(e.clientX-rect.left)/scale,y=(e.clientY-rect.top)/scale;
          const match=visible.find(n=>x>=n.x&&x<=n.x+cardWidth&&y>=n.y&&y<=n.y+cardHeight);
          if(match)onSelect(match.ball);
        }}>{Object.entries(dots).map(([key,parts])=><path key={key} d={parts.join('')} data-minimap="" className={'sov-dot-'+key}/>)}</svg>
        :visible.map(n=><button key={n.ball.id} type="button" data-ball={n.ball.id} className={'sov-ball sov-'+tone(n.ball.active)}
          style={{left:n.x,top:n.y,width:cardWidth,height:cardHeight}} title={display(n.ball)}
          aria-label={[display(n.ball),plans[n.ball.plan||'']||'方案未提供',activity(n.ball.active),'第 '+(n.depth+1)+' 層','直推 '+n.direct+' 球','查看球 360'].join('，')}
          onClick={()=>onSelect(n.ball)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();focusAdjacent(n,e.key);}}}>
          <span className="sov-node-top"><PlanMark plan={n.ball.plan}/><span>{activity(n.ball.active)}</span></span>
          <strong>{n.ball.name||'姓名未提供'}</strong><span className="sov-ball-no">{n.ball.ballNo||'球號未編配'}</span>
          <small>第 {n.depth+1} 層　直推 {n.direct} 球</small>
        </button>)}
      </div></div>
    </div>
  </>;
}

function ForestView({forest,selectedRootId,selection,renderBall360}:{forest:Forest}&MapProps){
  const [history,setHistory]=useState<string[]>(selectedRootId?[selectedRootId]:[]);
  const [selected,setSelected]=useState<string|null>(null),[page,setPage]=useState(0);
  const previousExternal=useRef({selectedRootId,selection});
  const selector=useRef<HTMLSelectElement>(null);
  useEffect(()=>{
    if(previousExternal.current.selectedRootId!==selectedRootId || previousExternal.current.selection!==selection) {
      previousExternal.current={selectedRootId,selection};
      setHistory(selectedRootId?[selectedRootId]:[]);setSelected(null);
    }
  },[selectedRootId,selection]);
  const focus=history[history.length-1]??null;
  const chosen=focus?forest.byId.get(focus):null;
  const detail=selected?forest.byId.get(selected):null;
  const layout=useMemo(()=>sponsorLayout(forest,focus),[forest,focus]);
  const pages=Math.ceil(forest.roots.length/60),pageIndex=Math.max(0,Math.min(page,pages-1));
  const roots=forest.roots.slice(pageIndex*60,(pageIndex+1)*60);
  const choose=(id:string)=>{
    setHistory(old=>{const index=old.indexOf(id);return index<0?[...old,id]:old.slice(0,index+1);});setSelected(null);
  };
  return <>
    <div className="sov-scope"><label>全貌起點<select ref={selector} value={focus??''} onChange={e=>e.target.value?choose(e.target.value):setHistory([])}>
      <option value="">全部推薦樹</option>
      {focus&&!roots.some(n=>n.id===focus)&&<option value={focus}>{chosen?display(chosen):'此球未列入推薦全貌'}</option>}
      {roots.map(n=><option key={n.id} value={n.id}>{display(n)}</option>)}
    </select></label>
      {pages>1&&<span className="sov-pages"><button type="button" disabled={pageIndex===0} onClick={()=>setPage(pageIndex-1)}>上一頁起點</button>
        {pageIndex+1} / {pages}<button type="button" disabled={pageIndex+1>=pages} onClick={()=>setPage(pageIndex+1)}>下一頁起點</button></span>}
      {focus&&<div className="sov-nav"><button type="button" onClick={()=>setHistory(old=>old.slice(0,-1))}>返回上一個起點</button>
        <button type="button" onClick={()=>setHistory([])}>返回全部推薦樹</button></div>}
    </div>
    {focus&&!chosen?<p role="status">所選球未列入本次推薦全貌。請返回全部推薦樹或重新選擇起點。</p>
    :<Diagram key={focus||'all'} focused={!!focus} forest={forest} layout={layout} onSelect={ball=>setSelected(ball.id)}/>}
    <DetailDrawer open={!!detail} title={detail?'球 360 · '+(detail.ballNo||detail.name||'球號未編配'):'球 360'} onClose={()=>setSelected(null)}>
      {detail&&<><div className="sov-detail"><strong>{display(detail)}</strong><span>直推 {forest.children.get(detail.id)!.length} 球</span>
        <button type="button" disabled={detail.id===focus} onClick={()=>{choose(detail.id);requestAnimationFrame(()=>selector.current?.focus({preventScroll:true}));}}>以此球為起點</button></div>
        {renderBall360(detail.id)}</>}
    </DetailDrawer>
  </>;
}
export function SponsorOverview({selectedRootId,selection,renderBall360}:MapProps){
  const query=useQuery({queryKey:['sponsor-overview'],queryFn:({signal})=>get<MapResponse>('/admin/observability/organization/sponsor-map',{signal}),retry:false,staleTime:60000});
  const model=useMemo(()=>{
    if(!query.data)return query.isSuccess?{error:'本次推薦資料不完整'}:null;
    const {data,meta}=query.data;
    if(!Array.isArray(data)||meta?.complete!==true||meta.total!==data.length||!Number.isFinite(Date.parse(meta.asOf))) return {error:'本次推薦資料不完整'};
    try{return {forest:sponsorForest(data),at:meta.asOf};}catch{return {error:'推薦關係無法核對，請檢查重複球、缺少的上層球或循環關係'};}
  },[query.data,query.isSuccess]);
  const conflict=query.error && 'status' in query.error && query.error.status===409;
  const error=conflict?'推薦關係資料不一致。重試後仍出現時，請核對目前的推薦紀錄':model?.error||'讀取推薦樹全貌失敗';
  return <section className="card sov" aria-label="推薦樹全貌">
    <header className="sov-header"><h2>推薦樹全貌</h2>{model?.at&&!query.isError&&<time dateTime={model.at}>台北時間 {time.format(new Date(model.at))}</time>}</header>
    <p className="sov-scope-note">包含已編球號且未作廢、未關閉的球，以及目前有效推薦關係中的球。可從下方搜尋姓名、手機或球號切換起點。</p>
    {query.isError||model?.error?<p role="alert">{error}。 <button type="button" disabled={query.isFetching} onClick={()=>void query.refetch()}>重試</button></p>
    :!model?.forest?<p role="status">正在載入推薦樹全貌…</p>
    :!model.forest.roots.length?<p role="status">目前沒有可顯示的推薦球。</p>
    :<ForestView forest={model.forest} selectedRootId={selectedRootId} selection={selection} renderBall360={renderBall360}/>}
  </section>;
}
