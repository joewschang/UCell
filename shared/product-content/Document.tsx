import {useState} from 'react';
import {ReviewMedia,type ReviewAttachment} from '../product-reviews/ReviewMedia';
import '../product-reviews/reviews.css';
import './content.css';
export type Run={text:string;bold?:boolean;italic?:boolean;underline?:boolean;href?:string};
export type Block={type:'paragraph'|'heading'|'bullet';runs:Run[]}|{type:'image'|'video'|'audio';mediaId:string;caption:string}|{type:'youtube';videoId:string;caption:string};
export type ProductDocument={blocks:Block[]};
function Text({runs}:{runs:Run[]}){return <>{runs.map((r,i)=>{let text=<>{r.text}</>;if(r.bold)text=<strong>{text}</strong>;if(r.italic)text=<em>{text}</em>;if(r.underline)text=<u>{text}</u>;if(r.href&&/^https:\/\//i.test(r.href))text=<a href={r.href} target="_blank" rel="noopener noreferrer">{text}</a>;return <span key={i}>{text}</span>;})}</>;}
function YouTube({id,caption}:{id:string;caption:string}){const [play,setPlay]=useState(false);return <figure>{play?<iframe className="content-youtube" src={'https://www.youtube-nocookie.com/embed/'+id} title={caption||'商品介紹影片'} allow="fullscreen; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button className="content-video-start" onClick={()=>setPlay(true)}>▶ 播放商品介紹影片<small>播放時將連線至 YouTube</small></button>}{caption&&<figcaption>{caption}</figcaption>}</figure>;}
export function ProductDocumentView({document,media,url,load}:{document:ProductDocument;media:ReviewAttachment[];url?:(id:string)=>string;load?:(id:string)=>Promise<Blob>}){return <div className="product-document">{document.blocks.map((b,i)=>{
 if(b.type==='heading')return <h3 key={i}><Text runs={b.runs}/></h3>;if(b.type==='paragraph')return <p key={i}><Text runs={b.runs}/></p>;if(b.type==='bullet')return <ul key={i}><li><Text runs={b.runs}/></li></ul>;
 if(b.type==='youtube')return <YouTube key={i+':'+b.videoId} id={b.videoId} caption={b.caption}/>;
 if('mediaId' in b){const item=media.find(m=>m.id===b.mediaId);return <figure key={i}>{item?<ReviewMedia items={[{...item,alt:b.caption}]} url={url} load={load}/>:<p>附件尚未提供</p>}{b.caption&&<figcaption>{b.caption}</figcaption>}</figure>;}return null;
 })}</div>;}
