(()=>{
const labels={classic:'經典',christmas:'聖誕節',newyear:'新年（元旦）',lunar:'中國年（農曆新年）'};
const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};
const taipei=d=>d?new Date(Date.parse(d)+28800000).toISOString().slice(0,16):'';
async function api(body){const response=await fetch('https://api.ucell.life/api/v1/admin/content/themes/calendar',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+sessionStorage.getItem('ucell_admin_token'),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});if(!response.ok)throw Error(response.status===409?'設定已變更或時段重疊，請重新讀取後確認。':'無法儲存或讀取主題，請確認權限與時間。');return (await response.json()).data}
class ThemeManager extends HTMLElement{
 connectedCallback(){if(this.childElementCount)return;
 const details=el('details'),title=el('summary','主題管理'),intro=el('p','使用臺北時間。未上架節慶時使用經典。開始留白表示立即，結束留白表示持續上架。'),out=el('div'),status=el('p');status.setAttribute('role','status');details.className='card';details.append(title,intro,out,status);this.append(details);
 const load=async()=>{try{draw(await api());status.textContent=''}catch(e){status.textContent=e.message}};
 const draw=rows=>{out.replaceChildren();for(const r of rows){
 const form=el('form'),heading=el('h3',labels[r.theme]),on=el('input');on.type='checkbox';on.checked=r.enabled;
 const field=(name,input)=>{const l=el('label',name+' ');l.append(input);return l};
 const time=(v)=>{const i=el('input');i.type='datetime-local';i.value=taipei(v);return i},start=time(r.starts),end=time(r.ends);
 const save=el('button','儲存設定');save.type='submit';form.className='card form';
 form.append(heading,field('上架',on),field('開始',start),field('結束',end));
 for(const [kind,label] of [['admin','後台登入音樂'],['member','會員迎賓音樂']]){const a=el('audio');a.controls=true;a.preload='none';const src=window.ucThemeCalendar.audio(kind,r.theme);a.src=(src.startsWith('/welcome-sound/')?'/seasons/audio/app_entry_many_coins.mp3':src);form.append(field(label,a))}
 form.append(save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;const iso=i=>i.value?new Date(i.value+':00+08:00').toISOString():null;try{draw(await api({theme:r.theme,enabled:on.checked,starts:iso(start),ends:iso(end),revision:r.revision}));status.textContent='主題設定已儲存。';window.ucThemeCalendar.refresh()}catch(err){status.textContent=err.message}finally{save.disabled=false}};out.append(form)}};
 details.ontoggle=()=>{if(details.open)load()};
 }}
customElements.define('uc-theme-manager',ThemeManager);
})();
