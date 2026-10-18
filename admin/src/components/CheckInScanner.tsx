import {useEffect,useRef,useState} from 'react';
import {BrowserQRCodeReader,type IScannerControls} from '@zxing/browser';
export function parseCheckInQr(value:string,kind:'EVENT'|'LEARNING'){
 const prefix='UCELL:'+kind+':';const token=value.startsWith(prefix)?value.slice(prefix.length):value;
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw Error('這不是此類活動的有效報到 QR Code');return token;
}
export function CheckInScanner({kind,busy,onToken}:{kind:'EVENT'|'LEARNING';busy:boolean;onToken:(token:string)=>void}){
 const video=useRef<HTMLVideoElement>(null),controls=useRef<IScannerControls>(),generation=useRef(0),[running,setRunning]=useState(false),[error,setError]=useState('');
 function stop(){generation.current++;controls.current?.stop();controls.current=undefined;setRunning(false);}
 useEffect(()=>()=>{generation.current++;controls.current?.stop()},[]);
 async function start(){stop();const run=generation.current;setError('');setRunning(true);try{const reader=new BrowserQRCodeReader();const c=await reader.decodeFromConstraints({video:{facingMode:'environment'},audio:false},video.current!, (result,_err,control)=>{if(result&&generation.current===run){try{const token=parseCheckInQr(result.getText(),kind);control.stop();stop();onToken(token)}catch(e){setError((e as Error).message)}}});if(run!==generation.current)c.stop();else controls.current=c;}catch{if(run===generation.current){setRunning(false);setError('無法開啟相機，請允許相機權限，或選擇 QR Code 圖片／輸入憑證。')}}}
 async function image(file?:File){if(!file)return;stop();const run=generation.current;setError('');const url=URL.createObjectURL(file);try{const result=await new BrowserQRCodeReader().decodeFromImageUrl(url);if(run===generation.current)onToken(parseCheckInQr(result.getText(),kind));}catch{setError('無法辨識此 QR Code，請重新選擇清楚的報到圖片。')}finally{URL.revokeObjectURL(url)}}
 return <section><button type="button" disabled={busy||running} onClick={()=>void start()}>掃描 QR Code 報到</button>{running&&<button type="button" onClick={stop}>關閉相機</button>}<video ref={video} hidden={!running} muted playsInline style={{width:'100%',maxWidth:480}}/><label>選擇 QR Code 圖片<input type="file" accept="image/*" disabled={busy} onChange={e=>{void image(e.target.files?.[0]);e.target.value=''}}/></label>{error&&<p role="alert">{error}</p>}</section>;
}
