(()=>{
'use strict';
const root=document.documentElement, names={classic:['經典','UCell 原色'],christmas:['聖誕','聖誕繽紛'],newyear:['新年（元旦）','煙火迎曙光'],lunar:['中國年','金紅迎新春']},endpoint=(location.hostname==='member.ucell.life'?'https://api.ucell.life':'')+'/api/v1/member/season-theme';
let token=null,theme='classic',state='',busy=false,failed=false,controller,ready=false,lastChoice=null;
function session(key){try{return sessionStorage.getItem(key)}catch{return null}}
function cacheKey(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h.toString(36)}
function remember(t){theme=Object.hasOwn(names,t)?t:'classic';root.dataset.season=theme;if(token){try{sessionStorage.setItem('uc-season-cache',JSON.stringify([cacheKey(token),theme]))}catch{}}}
function mode(){let pref;try{pref=localStorage.getItem('ucell.ui-theme-preference.v1')}catch{}root.dataset.seasonDark=(pref==='DARK'||pref!=='LIGHT'&&matchMedia('(prefers-color-scheme: dark)').matches)?'yes':'no'}
mode();addEventListener('storage',mode);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',mode);
const statusText=()=>busy?'正在套用主題…':failed?'無法儲存或讀取主題，請重試。':({synced:'已套用到會員前台與 LINE 選單。',unlinked:'已儲存前台主題。連結 LINE 帳號後，再開啟會員中心即可同步。',pending:'已儲存前台主題，LINE 選單尚未同步。請確認已加入官方帳號好友後重試。',default:'目前使用經典主題與原有的 LINE 選單。',loading:'正在讀取會員設定…',guest:'登入後可儲存主題並同步 LINE 選單。'}[state]||'');
const update=()=>document.querySelectorAll('uc-season-picker').forEach(x=>x.refresh());
async function api(body){
 const signal=controller.signal,res=await fetch(endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal});
 if(!res.ok)throw Error();const raw=await res.json(),s=raw.data||raw;if(!Object.hasOwn(names,s.theme)||!['synced','unlinked','pending','default'].includes(s.lineState))throw Error();return s;
}
async function save(body){
 if(!token||busy)return;
 lastChoice=body;const ticket=controller;busy=true;failed=false;update();
 try{const result=await api(body);if(controller!==ticket)return;remember(result.theme);state=result.lineState;ready=true;}
 catch{if(controller===ticket)failed=true}finally{if(controller===ticket){busy=false;update()}}
}
async function read(){
 const ticket=controller;
 try{const result=await api();if(controller!==ticket)return;remember(result.theme);ready=true;failed=false;state=result.lineState;update();if(result.needsSync)await save({sync:true})}
 catch{if(controller===ticket){ready=false;failed=true;update()}}
}
function auth(){
 const next=session('ucell_member_token')||'';if(next===token)return;
 controller?.abort();controller=new AbortController();token=next;lastChoice=null;busy=false;failed=false;ready=false;state=token?'loading':'guest';
 let cache;try{cache=JSON.parse(session('uc-season-cache'))}catch{}
 if(!next){try{sessionStorage.removeItem('uc-season-cache')}catch{}}
 remember(next&&cache?.[0]===cacheKey(next)?cache[1]:'classic');update();if(next)read();
}
class Picker extends HTMLElement{
 connectedCallback(){if(this.children.length)return;
 this.innerHTML='<div class="us-heading"><span>SEASONAL COLLECTION</span><h4>節慶主題</h4><p>選一款喜歡的風景，會員頁面與已連結的 LINE 選單會一起換裝。</p></div><div class="us-options" role="group" aria-label="選擇節慶主題"></div><details class="us-menu-preview" hidden><summary>查看這款 LINE 圖文選單大圖</summary><img width="1280" height="864" loading="lazy" alt=""></details><p class="us-status" role="status"></p><button type="button" class="us-retry" hidden>重新嘗試</button>';
 for(const [id,[label,detail]] of Object.entries(names)){const b=document.createElement('button');b.type='button';b.dataset.id=id;b.innerHTML='<span class="us-cover '+id+'" aria-hidden="true"><i>✓</i></span><strong>'+label+'</strong><small>'+detail+'</small>';b.onclick=()=>save({theme:id});this.querySelector('.us-options').append(b)}
 this.querySelector('.us-retry').onclick=()=>{if(ready)save(failed&&lastChoice?lastChoice:{sync:true});else{failed=false;state='loading';update();read()}};
 this.refresh();
 }
 refresh(){const preview=this.querySelector('.us-menu-preview');if(preview){preview.hidden=theme==='classic';const img=preview.querySelector('img');if(!preview.hidden){const src='/seasons/v1/menu-'+theme+'.jpg';if(img.getAttribute('src')!==src)img.setAttribute('src',src);img.alt=names[theme][0]+'圖文選單：左上會員中心、右上活動報名、左下線上商城、右下常見問答。'}}for(const b of this.querySelectorAll('[data-id]')){b.setAttribute('aria-pressed',String(b.dataset.id===theme));b.disabled=!ready||busy;}let s=this.querySelector('.us-status');if(s)s.textContent=statusText();let r=this.querySelector('.us-retry');if(r)r.hidden=busy||(!failed&&state!=='pending');}
}
customElements.define('uc-season-picker',Picker);auth();setInterval(auth,1300);addEventListener('pageshow',auth);document.addEventListener('visibilitychange',()=>{if(!document.hidden)auth()});
})();
