export const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
export function box(tag,cls,...children){const n=el(tag,null,cls);n.append(...children.filter(c=>c!=null));return n}
export function btn(text,fn,cls){const n=el('button',text,cls);n.type='button';n.onclick=fn;return n}
export function link(text,href,cls){const n=el('a',text,cls);n.href=href;return n}
export function apiFor(role){
 const base=location.hostname.endsWith('.ucell.life')?'https://api.ucell.life/api/v1':'/api/v1';
 return async(path,method='GET',body)=>{
   const headers={};const token=role!=='public'&&sessionStorage.getItem('ucell_'+role+'_token');
   if(token)headers.Authorization='Bearer '+token;
   if(body)headers['Content-Type']='application/json';
   const r=await fetch(base+'/'+role+'/health-game'+path,{method,headers,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error(({401:'登入已過期，請重新登入。',403:'目前帳號沒有這項權限。',409:'活動或版本已變更，請重新整理後再試。',422:'設定不符合規則，請確認標籤與資源。'})[r.status]||'目前無法連線，請再試一次。');
   const envelope=await r.json();return envelope.data;
 };
}
