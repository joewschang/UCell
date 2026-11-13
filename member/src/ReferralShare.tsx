import {useRef,useState} from 'react';
import type {Qualification} from './api';
import {createReferralShareLink} from './memberData';
import GreetingShareIcon from './GreetingShareIcon';
import './social-share.css';
export default function ReferralShare({q,contentId,productSku,eventCode,title='一起探索 UCell'}:{q:Qualification;contentId?:string;productSku?:string;eventCode?:string;title?:string}){
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),flight=useRef(false);
 async function share(platform:string){
  if(flight.current)return;
  flight.current=true;setBusy(true);setMessage('');
  try{
   const {shareUrl}=await createReferralShareLink(q,contentId,{productSku,eventCode});
   const url=encodeURIComponent(shareUrl),text=encodeURIComponent(title+' '+shareUrl);
   if(platform==='instagram'){
    try{await navigator.clipboard.writeText(shareUrl);setMessage('已複製推薦連結，可貼入 Instagram 訊息或限時動態。');}
    catch{setMessage('請複製連結後貼至 Instagram：'+shareUrl);}
   }else{
    const targets:Record<string,string>={line:'https://line.me/R/share?text='+text,facebook:'https://www.facebook.com/sharer/sharer.php?u='+url,threads:'https://www.threads.net/intent/post?text='+text,x:'https://twitter.com/intent/tweet?text='+text};
    location.assign(targets[platform]);
   }
  }catch{setMessage('無法建立推薦連結，請再試一次。');}
  finally{flight.current=false;setBusy(false);}
 }
 return <div className="uc-share-actions"><button className="uc-share-line" disabled={busy} onClick={()=>share('line')}>分享LINE好友</button><div className="uc-share-social">{(['facebook','threads','x','instagram'] as const).map(p=><button key={p} aria-label={'分享至 '+p} disabled={busy} onClick={()=>share(p)}><GreetingShareIcon platform={p}/></button>)}</div>{message&&<p role="status">{message}</p>}</div>;
}
