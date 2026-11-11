import {apiFor,el,box,btn,link} from '../context-ui.js';
export const member=!!sessionStorage.getItem('ucell_member_token');
export const api=apiFor(member?'member':'public');
const visitorKey='ucell.health.visitor.v1';
let visitor=localStorage.getItem(visitorKey);
if(!visitor){visitor=crypto.randomUUID();localStorage.setItem(visitorKey,visitor);}
const incoming=new URL(location.href).searchParams.get('invite');
const invitation=/^[\da-f-]{36}$/i.test(incoming||'')?incoming:null;
export function login(target){
 const action=link(target.includes('passport')?'登入領取本週印章':'登入後返回這裡','/');
 action.onclick=()=>{sessionStorage.setItem('ucell.health.return',JSON.stringify({target,until:Date.now()+900000}));};
 return action;
}
const dest='/health/';
function unavailable(message, retry=false){
 const main=document.querySelector('main');
 main.replaceChildren(el('h1','健康中心'),el('p',message),link('查看開放中的遊戲',dest),...(retry?[btn('重新載入',()=>location.reload())]:[]));
}
export async function session(id){
 let data;
 try{data=await api('/journey');}catch(e){unavailable(e.message,true);return null;}
 const game=data.games.find(g=>g.id===id);
 if(!game){unavailable('這支遊戲目前未開放。');return null;}
 if(game.membersOnly&&!member){unavailable('這支遊戲開放會員體驗。');document.querySelector('main').append(login(location.pathname+location.search));return null;}
 let attempt=crypto.randomUUID(),started=false,completed=false,queue=Promise.resolve();
 function send(action,resource){
   const body={attempt,visitor,game:id,action};
   if(invitation)body.invite=invitation;
   if(resource)body.resource=resource;
   if(resource)return api('/journey/event','POST',body).then(()=>true,()=>false);
   queue=queue.then(()=>api('/journey/event','POST',body)).then(()=>true,()=>false);
   return queue;
 }
 if(invitation)send('arrive');
 function start(){attempt=crypto.randomUUID();started=true;completed=false;return send('start');}
 async function finish(){
   if(completed)return true;
   if(!started)start();
   const ok=await send('finish');if(ok){completed=true;if(!member)sessionStorage.setItem('ucell.health.claim',JSON.stringify({game:id,attempt,visitor,expires:Date.now()+3600000}));}return ok;
 }
 function sharing(){
   const scope=el('select');scope.setAttribute('aria-label','邀請內容');
   for(const [val,name] of [['game','邀請體驗這支遊戲'],['all','通用邀請・只顯示健康中心']]){
     const opt=el('option',name);opt.value=val;scope.append(opt);
   }
   const out=el('div',null,'j-share-output');out.setAttribute('aria-live','polite');
   const row=el('div',null,'j-actions');
   async function share(channel){
     row.querySelectorAll('button').forEach(b=>b.disabled=true);
     out.replaceChildren(el('span','正在準備邀請…'));
     try{
       const generic=scope.value==='all';
       const {id:code}=await api('/journey/invite','POST',{visitor,game:id,generic,channel});
       const url=location.origin+dest+'journey/invite/'+(generic?'':id+'/')+'?id='+code;
       const input=el('input');input.readOnly=true;input.value=url;input.setAttribute('aria-label','邀請連結');input.onclick=()=>input.select();
       if(channel==='qr'){
         const {toDataURL}=await import('./qr.js');
         const image=el('img');image.src=await toDataURL(url,{width:240,margin:4});image.alt='健康中心邀請 QR Code';out.replaceChildren(image,input);
       }else if(channel==='line'){
         const next=link('開啟 LINE 選擇分享對象','https://line.me/R/share?text='+encodeURIComponent((generic?'邀你來玩 UCell 健康中心。':game.invite)+' '+url),'j-primary');
         out.replaceChildren(next,input);next.focus();
       }else{
         try{await navigator.clipboard.writeText(url);out.replaceChildren(el('p','已複製邀請連結。'),input);}
         catch{out.replaceChildren(el('p','長按或選取下方連結即可複製。'),input);input.focus();input.select();}
       }
     }catch(e){out.replaceChildren(el('p',e.message),link('開啟可手動分享的頁面',scope.value==='all'?dest:game.href));}
     finally{row.querySelectorAll('button').forEach(b=>b.disabled=false);}
   }
   scope.onchange=()=>out.replaceChildren();
   for(const [key,title] of [['line','LINE 邀請'],['copy','複製連結'],['qr','顯示 QR Code']])row.append(btn(title,()=>share(key)));
   return box('div','j-share',scope,row,out,...(member?[]:[login('/health/?passport=1')]));
 }
 function explore(){
   const list=el('div',null,'j-related');const open=btn('我想'+game.interest,async()=>{
     open.disabled=true;
     try{
       const rows=await api('/journey/related?game='+id);
       list.replaceChildren();
       for(const r of rows){
         const a=link(r.title,r.href);a.onclick=async e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();await Promise.race([send('click',r.id),new Promise(resolve=>setTimeout(resolve,1200))]);if(member){sessionStorage.setItem('ucell.health.click',JSON.stringify({attempt,visitor,game:id,resource:r.id,href:r.href,expires:Date.now()+3600000}));}sessionStorage.setItem('ucell.health.back',String(Date.now()));location.assign(a.href);};
         list.append(box('article','j-resource',el('small',r.kind),a,r.detail?el('span',r.detail):null));
         send('impression',r.id);
       }
       if(!rows.length){
         const fallback={'blood-pressure':['看居家量測圖卡','/health/blood-pressure/images/posture.jpg'],game:['在家觀察前的準備','/health/?read=guide'],diabetes:['查看血糖健康主題','/topics/?tag='+encodeURIComponent('血糖健康')],egfr:['重看腎臟過濾圖解','/health/egfr/#kidney']};
         list.append(el('p','目前沒有精選項目，可先閱讀這份資料。'),link(...fallback[id]));
       }
       if(!member)list.append(login('/health/journey/resources/?game='+id));
       open.hidden=true;
     }catch(e){list.textContent=e.message;open.disabled=false;}
   });
   return box('section','j-next',el('h2','接下來想了解什麼？'),open,list);
 }
 return {member,start,finish,calculated(){if(!started||completed)start();return send('calculate');},sharing,explore};
}
