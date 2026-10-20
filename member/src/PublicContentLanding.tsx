import {useEffect,useRef,useState} from 'react';
import {CompanyLogo} from '@ucell/design-system';
import {unwrapMemberEnvelope} from './memberApi';
import {recordReferralLanding} from './liff';
import type {MemberContent} from './memberData';
import {ContentMedia} from './ContentMedia';
type Preview={content:MemberContent|null;requiresLogin:boolean;destination:string;expiresAt?:string;notice?:string};
async function read(path:string){
 const response=await fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+path,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('內容或分享連結已失效、下架，或目前無法讀取。');
 return unwrapMemberEnvelope(await response.json());
}
export default function PublicContentLanding({token,contentId}:{token?:string;contentId?:string}){
 const [preview,setPreview]=useState<Preview>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState(false),[attempt,setAttempt]=useState(0);
 const flight=useRef<Promise<Preview>>();
 useEffect(()=>{
  let alive=true;setError('');setReady(false);
  if(!flight.current)flight.current=(async()=>{
   const result:Preview=token?await read('/referrals/preview/'+encodeURIComponent(token)) as Preview:
    {content:await read('/public/content/'+encodeURIComponent(contentId!)) as MemberContent,requiresLogin:false,destination:'/content/'+contentId};
   if(token){
    try{const landing=await recordReferralLanding(token);result.notice=landing.accepted?'推薦來源已記錄；正式推薦關係依會員制度確認。':'您已有有效的推薦來源，本次瀏覽不會變更原來源。';}
    catch{result.notice='內容仍可瀏覽，但推薦來源尚未成功記錄。請重新載入後再登入，以免遺失來源。';}
   }
   return result;
  })();
  flight.current.then(result=>{if(alive){setPreview(result);setNotice(result.notice??'');setReady(true);document.title=(result.content?.title??'朋友與您分享')+'｜UCell';}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'無法載入內容');});
  return()=>{alive=false;};
 },[token,contentId,attempt]);
 const retry=()=>{flight.current=undefined;setAttempt(n=>n+1);};
 const destination=preview?.destination&&/^\/(?:content\/[0-9a-f-]{36})?$/i.test(preview.destination)?preview.destination:'/';
 return <div className="uc-public-content"><header><a href="https://ucell.life" aria-label="UCell 官網"><CompanyLogo/></a><a href="https://ucell.life/resources.html">探索更多影音 →</a></header><main>
 {error?<section className="card"><h1>這份分享暫時無法開啟</h1><p role="alert">{error}</p><button onClick={retry}>重新載入</button><a className="button" href="https://ucell.life/resources.html">探索其他內容</a></section>:!ready?<p role="status">正在準備內容…</p>:<>
 <article className="card uc-content-detail"><small className="uc-eyebrow">{token?'朋友與您分享':'UCELL STORIES'}</small><h1>{preview?.content?.title??(preview?.requiresLogin?'為會員準備的精彩內容':'歡迎認識 UCell')}</h1>
 <p className="uc-content-summary">{preview?.content?.summary??(preview?.requiresLogin?'登入或註冊後即可查看這份會員內容，完成後會回到這裡。':'探索品牌、商品與活動，開啟更好的生活體驗。')}</p>
 {preview?.content&&<ContentMedia url={preview.content.url} title={preview.content.title} thumbnailUrl={preview.content.thumbnailUrl}/>}
 <div className="uc-content-actions"><a className="button primary" href={destination}>{preview?.requiresLogin?'登入查看內容':'登入會員繼續探索'}</a><a className="button" href={destination+'?mode=register'}>註冊會員</a></div></article>
 {notice&&<aside className="card"><p role="status">{notice}</p><small>首次有效推薦來源保留 30 天；換裝置或清除瀏覽資料可能無法延續。</small><button onClick={retry}>重新確認推薦來源</button></aside>}
 <section className="card"><h2>繼續探索</h2><div className="uc-content-actions"><a className="button" href="/shop">商品商城</a><a className="button" href="/events">近期活動</a><a className="button" href="https://ucell.life/resources.html">更多影音</a></div></section></>}
 </main><footer>UCell · 分享生活的美好 <a href="https://ucell.life/privacy.html">隱私權政策</a></footer></div>;
}
