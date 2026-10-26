import {BadRequestException} from '@nestjs/common';
export function contentDocument(value:any){
 const fail=()=>{throw new BadRequestException({code:'PRODUCT_CONTENT_INVALID',message:'商品說明格式不正確，請檢查文字、附件及連結。'});};
 if(!value||!Array.isArray(value.blocks)||value.blocks.length>100)fail();let total=0;
 const blocks=value.blocks.map((b:any)=>{
  if(!b||typeof b!=='object')return fail();
  if(['paragraph','heading','bullet'].includes(b.type)){
   if(!Array.isArray(b.runs)||b.runs.length>500) return fail();
   return {type:b.type,runs:b.runs.map((r:any)=>{if(!r||typeof r.text!=='string'||r.text.length>20000)return fail();total+=r.text.length;if(total>50000)return fail();if(r.href!==undefined&&(!/^https:\/\//i.test(r.href)||r.href.length>2048))return fail();let href;if(r.href){try{const u=new URL(r.href);if(u.username||u.password||u.protocol!=='https:')return fail();href=u.href;}catch{return fail();}}return {text:r.text,...(r.bold===true?{bold:true}:{}),...(r.italic===true?{italic:true}:{}),...(r.underline===true?{underline:true}:{}),...(href?{href}:{})};})};
  }
  if(['image','video','audio'].includes(b.type)){if(typeof b.mediaId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.mediaId)||typeof b.caption!=='string'||b.caption.length>300)return fail();return {type:b.type,mediaId:b.mediaId,caption:b.caption};}
  if(b.type==='youtube'){if(typeof b.videoId!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(b.videoId)||typeof b.caption!=='string'||b.caption.length>300)return fail();return {type:b.type,videoId:b.videoId,caption:b.caption};}
  return fail();
 });return {blocks};
}
export function contentMediaIds(doc:any):string[]{return [...new Set<string>(doc.blocks.filter((b:any)=>b.mediaId).map((b:any)=>b.mediaId))];}
