import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {DetailDrawer} from '@ucell/design-system';
import {get} from '../../lib/api';
import {QualificationDetail} from '../qualifications/QualificationDetail';
import {layoutTree,MapBall} from './binary-map-layout';
import './binary-overview.css';

const path='/admin/observability/organization/binary-map';
const plans:Record<string,string>={STARTER:'啟航',ELITE:'菁英',LEADER:'領袖'};
type Tree={binaryTreeId:string;treeName:string;treeCode:string;status:string};
function Mark({plan}:{plan:string|null}){
  return <svg aria-hidden="true" viewBox="0 0 32 30">{plan==='STARTER'?<circle cx="16" cy="15" r="12"/>:plan==='ELITE'?<rect x="4" y="3" width="24" height="24" rx="2"/>:plan==='LEADER'?<path d="M2 7l8 5 6-10 6 10 8-5-4 16H6zm5 18h18v3H7z"/>:<path d="M16 2l13 13-13 13L3 15z"/>}</svg>;
}
export function BinaryMap(){
  const trees=useQuery({queryKey:['binary-map-trees'],queryFn:({signal})=>get<{data:Tree[]}>(path,{signal})});
  const [choice,setChoice]=useState('');
  const list=trees.data?.data??[];
  const treeId=choice||list.find(t=>t.status==='ACTIVE')?.binaryTreeId||list[0]?.binaryTreeId;
  const data=useQuery({queryKey:['binary-map',treeId],enabled:!!treeId,queryFn:({signal})=>get<{data:MapBall[]}>(path+'/'+treeId,{signal})});
  return <section className="card bm" aria-label="二元樹全貌"><header><h2>二元樹全貌</h2>{list.length>1&&<label>組織樹 <select value={treeId} onChange={e=>setChoice(e.target.value)}>{list.map(t=><option value={t.binaryTreeId} key={t.binaryTreeId}>{t.treeName}（{t.treeCode}）</option>)}</select></label>}</header>
  {trees.isError||data.isError?<p role="alert">讀取組織樹失敗。 <button onClick={()=>void (trees.isError?trees.refetch():data.refetch())}>重試</button></p>:trees.isPending||treeId&&data.isPending?<p role="status">正在載入全樹…</p>:!data.data?.data.length?<p>目前沒有已安置的球。</p>:<MapCanvas key={treeId} balls={data.data.data}/>}</section>;
}
function MapCanvas({balls}:{balls:MapBall[]}){
  const layout=useMemo(()=>{try{return layoutTree(balls)}catch{return null}},[balls]);
  const [zoom,setZoom]=useState(1),[selected,setSelected]=useState<MapBall|null>(null);
  const viewport=useRef<HTMLDivElement>(null),anchor=useRef<{x:number;y:number}|null>(null);
  const drag=useRef<{x:number;y:number;left:number;top:number}|null>(null);
  useLayoutEffect(()=>{const el=viewport.current;if(!el||!layout)return;
    const focus=anchor.current??{x:layout.nodes[0].x,y:0};el.scrollLeft=focus.x*zoom-el.clientWidth/2;el.scrollTop=focus.y*zoom-el.clientHeight/2;
  },[zoom,layout]);
  useEffect(()=>{const end=()=>{drag.current=null};window.addEventListener('blur',end);return()=>window.removeEventListener('blur',end)},[]);
  if(!layout)return <p role="alert">組織位置不完整，請重新載入後核對。</p>;
  function scale(next:number,fit=false){const el=viewport.current;if(!el||!layout)return;
    anchor.current=fit?{x:layout.width/2,y:layout.height/2}:{x:(el.scrollLeft+el.clientWidth/2)/zoom,y:(el.scrollTop+el.clientHeight/2)/zoom};setZoom(next);
    if(fit){el.scrollTo(0,0)}
  }
  const fit=()=>{const el=viewport.current;if(el)scale(Math.min(1,(el.clientWidth-4)/layout.width,(el.clientHeight-4)/layout.height),true)};
  return <><div className="bm-tools"><div className="bm-legend">{Object.entries(plans).map(([code,name])=><span key={code}><Mark plan={code}/>{name}</span>)}<span className="bm-on">● 活躍</span><span className="bm-off">● 不活躍</span></div>
  <div className="bm-zoom"><button aria-label="縮小" disabled={zoom<=0.05} onClick={()=>scale(Math.max(.05,zoom/1.4))}>−</button><button title="還原為 100%" onClick={()=>scale(1)}>{Math.round(zoom*100)}%</button><button aria-label="放大" disabled={zoom>=3} onClick={()=>scale(Math.min(3,zoom*1.4))}>＋</button><button onClick={fit}>顯示全樹</button></div></div>
  <p className="bm-note">{balls.length} 顆已安置球 · 拖移空白處瀏覽，點選球號查看 360</p>
  <div className="bm-viewport" ref={viewport} tabIndex={0} aria-label="可捲動的二元樹"
   onPointerDown={e=>{if(e.pointerType!=='mouse'||e.button!==0||(e.target as Element).closest('button'))return;const el=e.currentTarget;drag.current={x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop};el.setPointerCapture(e.pointerId)}}
   onPointerMove={e=>{const d=drag.current;if(d){e.currentTarget.scrollLeft=d.left+d.x-e.clientX;e.currentTarget.scrollTop=d.top+d.y-e.clientY}}}
   onLostPointerCapture={()=>{drag.current=null}} onPointerUp={()=>{drag.current=null}}>
  <div className="bm-size" style={{width:layout.width*zoom,height:layout.height*zoom}}><div className="bm-paper" style={{width:layout.width,height:layout.height,transform:'scale('+zoom+')'}}>
   <svg className="bm-lines" aria-hidden="true" width={layout.width} height={layout.height}>{layout.edges.map(e=><path key={e.cx+','+e.cy} d={`M${e.x} ${e.y+96} V${e.cy-17} H${e.cx} V${e.cy}`}/>)}</svg>
   {layout.nodes.map(({ball,x,y})=><button className={'bm-ball '+(ball.active?'bm-on':'bm-off')} key={ball.id} style={{left:x,top:y}} onClick={()=>setSelected(ball)} aria-label={[ball.ballNo,ball.name,plans[ball.plan??'']??'方案未提供',ball.active?'活躍':'不活躍','查看球 360'].join('，')}><Mark plan={ball.plan}/><strong>{ball.ballNo}</strong><span title={ball.name}>{ball.name}</span></button>)}
  </div></div></div><DetailDrawer open={!!selected} title={selected?'球 360 · '+selected.ballNo:'球 360'} onClose={()=>setSelected(null)}>{selected&&<QualificationDetail key={selected.id} id={selected.id}/>}</DetailDrawer></>;
}