import {useEffect,useRef,useState} from 'react';
import {getFormalDocuments,uploadFormalDocument} from './memberData';
import {useResource} from './useResource';
import './signature.css';
export default function MembershipSignature({applicationId,onReady}:{applicationId:string;onReady:(ready:boolean)=>void}){
 const state=useResource('signature:'+applicationId,signal=>getFormalDocuments(applicationId,signal),true,true);
 const canvas=useRef<HTMLCanvasElement>(null),drawing=useRef(false),distance=useRef(0),last=useRef({x:0,y:0});
 const [ink,setInk]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),largeCanvas=useRef<HTMLCanvasElement>(null),expandButton=useRef<HTMLButtonElement>(null);
 const [expanded,setExpanded]=useState(false);
 const existing=state.data?.documents.some(d=>d.type==='SIGNED_APPLICATION_AGREEMENT'&&d.status==='PRESENT')??false;
 useEffect(()=>{onReady(existing||saved);},[existing,saved,onReady]);
 function point(e:React.PointerEvent<HTMLCanvasElement>){const box=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-box.left)*900/box.width,y:(e.clientY-box.top)*300/box.height};}
 function clear(){for(const ref of [canvas,largeCanvas])ref.current?.getContext('2d')?.clearRect(0,0,900,300);distance.current=0;drawing.current=false;setInk(false);setConsent(false);}
 async function enlarge(){
  if(busy||!dialog.current||!canvas.current||!largeCanvas.current)return;
  largeCanvas.current.getContext('2d')!.clearRect(0,0,900,300);
  largeCanvas.current.getContext('2d')!.drawImage(canvas.current,0,0);
  drawing.current=false;dialog.current.showModal();setExpanded(true);
  try{await dialog.current.requestFullscreen?.();if(!dialog.current.open){if(document.fullscreenElement===dialog.current)await document.exitFullscreen();return;}await (screen.orientation as ScreenOrientation & {lock?:(value:string)=>Promise<void>})?.lock?.('landscape');}catch{/* The landscape hint remains available in browsers that cannot rotate. */}
 }
 function finish(){
  if(canvas.current&&largeCanvas.current){const c=canvas.current.getContext('2d')!;c.clearRect(0,0,900,300);c.drawImage(largeCanvas.current,0,0);}
  drawing.current=false;dialog.current?.close();setExpanded(false);
  if(document.fullscreenElement===dialog.current){try{screen.orientation?.unlock?.();}catch{}void document.exitFullscreen().catch(()=>{});}
  expandButton.current?.focus();
 }
 useEffect(()=>{if(!expanded)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[expanded]);

 async function save(){if(!ink||!consent||busy||!state.data?.signingContext)return;setBusy(true);setError('');try{
  const context=state.data.signingContext,output=document.createElement('canvas');output.width=1100;output.height=760;const c=output.getContext('2d')!;
  c.fillStyle='#fff';c.fillRect(0,0,1100,760);c.fillStyle='#122f32';c.font='bold 32px sans-serif';c.fillText('UCell 正式會員申請簽名',40,60);c.font='22px sans-serif';
  c.fillText('申請人：'+context.name,40,110);c.fillText('本人確認申請資料正確，並同意已閱讀的正式會員合約。',40,155);
  c.fillText('申請版本：'+context.version+'　合約版本：'+context.contract.version,40,200);
  c.font='16px monospace';c.fillText('Application: '+applicationId,40,245);c.fillText('Snapshot: '+context.snapshotHash,40,275);c.fillText('Contract SHA256: '+context.contract.contentHash,40,305);
  c.font='20px sans-serif';c.fillText('簽署時間：'+new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+'（台北時間）',40,350);
  c.drawImage(canvas.current!,80,390,900,300);c.strokeStyle='#aab';c.strokeRect(80,390,900,300);
  const blob=await new Promise<Blob>((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error('無法產生簽名圖片')),'image/png'));
  await uploadFormalDocument(applicationId,'SIGNED_APPLICATION_AGREEMENT',new File([blob],'membership-signature.png',{type:'image/png'}),context.snapshotHash);setSaved(true);state.retry();
 }catch(e){setError(e instanceof Error?e.message:'簽名儲存失敗，請重試');}finally{setBusy(false);}}
 return <section className="membership-signature"><h3>會員簽名</h3>{state.error?<><p role="alert">{state.error}</p><button onClick={state.retry}>重新讀取簽名狀態</button></>:!state.data?<p>正在讀取申請版本…</p>:existing||saved?<p role="status">簽名已保存，後台審查人員可檢視。</p>:<><p>請以手指、觸控筆或滑鼠在框內親自簽名。簽名將與此版申請資料一起保存。</p><p>{state.data.signingContext?.name} · {state.data.signingContext?.contract.title} · 申請第 {state.data.signingContext?.version} 版</p>
<div className="signature-pad-heading"><span>簽名區</span><button ref={expandButton} type="button" disabled={busy} onClick={enlarge} aria-label="放大簽名區"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6"/></svg>放大簽名</button></div>
 <canvas ref={canvas} width={900} height={300} aria-label="會員手寫簽名區" onPointerDown={e=>{if(busy)return;e.preventDefault();drawing.current=true;last.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drawing.current||busy)return;e.preventDefault();const next=point(e),c=e.currentTarget.getContext('2d')!;c.strokeStyle='#132d31';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(last.current.x,last.current.y);c.lineTo(next.x,next.y);c.stroke();distance.current+=Math.hypot(next.x-last.current.x,next.y-last.current.y);last.current=next;if(distance.current>30)setInk(true);}} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/>
 <dialog ref={dialog} className="signature-dialog" aria-labelledby="signature-dialog-title" onCancel={e=>{e.preventDefault();finish();}}>
 <div className="signature-dialog-content"><header><h3 id="signature-dialog-title">放大簽名</h3><button type="button" onClick={finish}>完成返回</button></header><p className="signature-rotate-hint">↻ 請將手機橫放，使用較寬的畫面簽名。</p><p className="signature-dialog-help">請在白色區域簽名；完成返回後，再確認並儲存會員簽名。</p>
 <div className="signature-large-pad"><canvas ref={largeCanvas} width={900} height={300} aria-label="放大手寫簽名區" onPointerDown={e=>{if(busy)return;e.preventDefault();drawing.current=true;last.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drawing.current||busy)return;e.preventDefault();const next=point(e),c=e.currentTarget.getContext('2d')!;c.strokeStyle='#132d31';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(last.current.x,last.current.y);c.lineTo(next.x,next.y);c.stroke();distance.current+=Math.hypot(next.x-last.current.x,next.y-last.current.y);last.current=next;if(distance.current>30)setInk(true);}} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/></div>
 <footer><button type="button" onClick={clear}>清除重簽</button><button type="button" className="primary" onClick={finish}>完成返回</button></footer></div></dialog>
 <label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>本人確認申請資料正確，並同意已閱讀的正式會員合約。</label><div className="button-row"><button type="button" disabled={busy} onClick={clear}>清除重簽</button><button type="button" className="primary" disabled={busy||!ink||!consent||!state.data.signingContext} onClick={save}>{busy?'儲存簽名中…':'儲存會員簽名'}</button></div></>}{error&&<p role="alert">{error}</p>}</section>;
}
