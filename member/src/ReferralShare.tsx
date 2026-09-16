import {useRef,useState} from 'react';
import type {Qualification} from './api';
import {createReferralShareLink} from './memberData';

export default function ReferralShare({q}:{q:Qualification}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[share,setShare]=useState<{shareUrl:string;expiresAt:string}|null>(null),flight=useRef(false);
 async function create(){if(flight.current)return;flight.current=true;setBusy(true);setError('');try{setShare(await createReferralShareLink(q));}catch(reason){setError(reason instanceof Error?reason.message:'無法建立推薦連結');}finally{flight.current=false;setBusy(false);}}
 async function shareNow(){if(!share)return;try{if(navigator.share)await navigator.share({title:'UCell',url:share.shareUrl});else if(navigator.clipboard)await navigator.clipboard.writeText(share.shareUrl);else throw new Error('此裝置不支援分享或複製');}catch(reason){setError(reason instanceof Error?reason.message:'分享未完成');}}
 return <section className="card"><h3>分享推薦連結</h3><p>連結由伺服器綁定目前球位；推薦歸屬仍須由後端依正式規則確認，不會直接改寫 Sponsor。</p><button disabled={busy} onClick={create}>{busy?'建立中…':'建立推薦連結'}</button>{share&&<div role="status"><p className="break-all">{share.shareUrl}</p><p>有效至：{new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date(share.expiresAt))}</p><button onClick={shareNow}>分享或複製</button></div>}{error&&<p role="alert">{error}</p>}</section>;
}
