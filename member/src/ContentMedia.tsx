import {uiText} from '../../shared/design-system/i18n';
import {useState} from 'react';
export function safeMediaUrl(value:string|null|undefined){
 try{const url=new URL(value??'');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function youtubeEmbed(value:string){
 const safe=safeMediaUrl(value);if(!safe)return null;
 const url=new URL(safe);
 const id=url.hostname==='youtu.be'?url.pathname.slice(1):
 ['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname)?
 (url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]):null;
 return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}`:null;
}
export function ContentCover({src,title}:{src:string|null;title:string}){
 const [failed,setFailed]=useState(false),safe=safeMediaUrl(src);
 return <div className="uc-content-cover">{safe&&!failed?<img src={safe} alt={title} loading="lazy" onError={()=>setFailed(true)}/>:<div className="uc-content-placeholder"><span>UCELL</span><small>探索生活的更多可能</small></div>}</div>;
}
export function ContentMedia({url,title,thumbnailUrl}:{url:string;title:string;thumbnailUrl:string|null}){
 const [play,setPlay]=useState(false),embed=youtubeEmbed(url),safe=safeMediaUrl(url);
 return <div className="uc-content-media">{embed&&play?<iframe src={embed} title={title} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<ContentCover src={thumbnailUrl} title={title}/>}
 <div className="uc-content-actions">{embed&&!play&&<button className="primary" onClick={()=>setPlay(true)}>▶ 播放影片</button>}{safe&&<a className="button" href={safe} target="_blank" rel="noopener noreferrer">{embed?'另開 YouTube 觀看':'開啟內容（另開視窗）'}</a>}</div>
 {embed&&<small>{uiText('點選播放後會載入 YouTube 播放器。若無法播放，可另開 YouTube 觀看。')}</small>}</div>;
}
