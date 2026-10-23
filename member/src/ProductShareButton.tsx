import {useState} from 'react';
import type {Qualification} from './api';
import ReferralShare from './ReferralShare';
export default function ProductShareButton({q,sku,title,category}:{q?:Qualification;sku?:string;title:string;category?:string}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState('');
 const url='https://member.ucell.life/shop'+(sku?'/products/'+encodeURIComponent(sku):category?'?category='+encodeURIComponent(category):'');
 async function share(){try{if(navigator.share)await navigator.share({title,url});else{await navigator.clipboard.writeText(url);setMessage('已複製商品連結，可以貼給朋友。');}}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setMessage('無法自動分享，請選取下方網址複製。');}}
 return <div className="cart-product-share"><button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>分享商品</button>{open&&(q&&sku?<ReferralShare q={q} productSku={sku} title={title}/>:<section><p>分享商品給朋友。一般連結不包含會員推薦歸因。</p><button onClick={()=>void share()}>傳送或複製連結</button><a href={'https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(url)} target="_blank" rel="noopener noreferrer">LINE 分享</a><label>商品連結<input readOnly value={url} onFocus={e=>e.currentTarget.select()}/></label>{message&&<p role="status">{message}</p>}</section>)}</div>;
}
