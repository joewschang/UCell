import {uiText} from '../../shared/design-system/i18n';
import {useRef,useState} from 'react';
import type {Qualification} from './api';
import {createReferralShareLink} from './memberData';
export default function ReferralShare({q,contentId,title='一起探索 UCell'}:{q:Qualification;contentId?:string;title?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[qr,setQr]=useState('');
 const [share,setShare]=useState<{shareUrl:string;expiresAt:string}|null>(null),flight=useRef(false);
 async function create(){if(flight.current)return;flight.current=true;setBusy(true);setError('');setNotice('');setQr('');try{setShare(await createReferralShareLink(q,contentId));setNotice('分享連結已準備好，請選擇分享方式。');}catch(e){setError(e instanceof Error?e.message:'無法建立分享連結');}finally{flight.current=false;setBusy(false);}}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('已複製，可以貼給朋友了。');setError('');}catch{setError('此瀏覽器無法自動複製，請選取下方連結手動複製。');}}
 async function shareNow(){if(!share)return;try{if(navigator.share)await navigator.share({title,text:`推薦您看看：${title}`,url:share.shareUrl});else await copy(share.shareUrl);}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError('分享未完成，您可以改用複製連結。');}}
 async function showQr(){if(!share)return;try{const code=await import('qrcode');setQr(await code.toDataURL(share.shareUrl,{width:320,margin:4,errorCorrectionLevel:'M'}));}catch{setError('QR Code 暫時無法產生，請改用複製連結。');}}
 const expired=share&&Date.parse(share.expiresAt)<=Date.now();
 return <section className="card uc-share-panel"><small className="uc-eyebrow">與朋友分享</small><h3>{contentId?'把好內容分享出去':'邀請朋友認識 UCell'}</h3><p>使用目前球位 {q.code} 的推薦連結。首次有效推薦來源保留 30 天，正式推薦關係與訂單歸屬依系統規則確認。</p>
 <button className="primary" disabled={busy} onClick={create}>{busy?'正在準備…':share?'重新產生連結':contentId?'建立內容分享連結':'建立推薦連結'}</button>
 {share&&!expired&&<><div className="uc-content-actions"><a className="button uc-line-share" href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(share.shareUrl)}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener noreferrer">LINE 分享</a><button onClick={()=>void copy(share.shareUrl)}>複製連結</button><button onClick={()=>void shareNow()}>更多分享方式</button><button onClick={()=>void showQr()}>{uiText('QR Code')}</button></div>
 <label className="uc-share-url">分享連結<input readOnly value={share.shareUrl} onFocus={e=>e.currentTarget.select()}/></label><details><summary>建議分享文字</summary><p>推薦您看看：{title}。點開連結了解更多！</p><button onClick={()=>void copy(`推薦您看看：${title}。點開連結了解更多！\n${share.shareUrl}`)}>複製文字與連結</button></details><small>連結有效至 {new Date(share.expiresAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}。重新產生不會停用舊連結，可到分享成效頁個別停用。</small>
 {qr&&<figure className="uc-share-qr"><img src={qr} width="320" height="320" alt={uiText('此推薦連結的 QR Code')}/><figcaption>讓朋友掃描，開啟同一個分享連結。</figcaption><a href={qr} download="ucell-share.png">{uiText('下載 QR Code')}</a></figure>}</>}
 {expired&&<p role="status">連結已過期，請重新產生。</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
