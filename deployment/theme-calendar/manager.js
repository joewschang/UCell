(()=>{
const labels={classic:'經典',christmas:'聖誕節',newyear:'新年（元旦）',lunar:'中國年（農曆新年）'};
const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e};
const taipei=d=>d?new Date(Date.parse(d)+28800000).toISOString().slice(0,16):'';
async function api(body){const response=await fetch('https://api.ucell.life/api/v1/admin/content/themes/calendar',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+sessionStorage.getItem('ucell_admin_token'),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});if(!response.ok)throw Error(response.status===409?'設定已變更或時段重疊，請重新讀取後確認。':'無法儲存或讀取主題，請確認權限與時間。');return (await response.json()).data}
function birthdayPreview(){
 const panel=el('section'),heading=el('h3','會員生日'),audio=el('audio'),list=el('ul'),status=el('p');
 const open=el('button','預覽當月壽星'),previous=el('button','上一頁'),next=el('button','下一頁');
 const pager=el('div'),results=el('div');let members=[],month='',page=0;
 panel.className='card';audio.controls=true;audio.preload='none';audio.src='/seasons/audio/birthday_app_welcome.mp3';audio.setAttribute('aria-label','生日主題音樂');
 audio.style.maxWidth='100%';status.setAttribute('role','status');
 for(const button of [open,previous,next])button.type='button';
 pager.className='button-row';pager.append(previous,next);
 results.append(status,list,pager);results.hidden=true;
 function draw(){
  const start=page*20;status.textContent=month+' 月壽星 · '+members.length+' 位'+(members.length>20?' · 第 '+(page+1)+'／'+Math.ceil(members.length/20)+' 頁':'');
  list.replaceChildren(...members.slice(start,start+20).map(r=>el('li',Number(month.slice(5))+' 月 '+r.day+' 日　'+r.name+'（'+r.memberNo+'）')));
  pager.hidden=members.length<=20;previous.disabled=page===0;next.disabled=start+20>=members.length;
 }
 previous.onclick=()=>{page--;draw()};next.onclick=()=>{page++;draw()};
 open.setAttribute('aria-expanded','false');
 open.onclick=async()=>{
  if(!results.hidden){results.hidden=true;list.replaceChildren();members=[];open.textContent='預覽當月壽星';open.setAttribute('aria-expanded','false');return}
  results.hidden=false;pager.hidden=true;open.disabled=true;open.setAttribute('aria-expanded','true');status.textContent='正在讀取本月壽星…';
  try{const response=await fetch('https://api.ucell.life/api/v1/admin/content/themes/birthday-month',{headers:{Authorization:'Bearer '+sessionStorage.getItem('ucell_admin_token')},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();
   const {data}=await response.json();members=data.members;month=data.month;page=0;draw();open.textContent='收起壽星清單';
  }catch{status.textContent='無法讀取本月壽星，請確認登入狀態後重試。';open.textContent='重新讀取';open.setAttribute('aria-expanded','true');open.onclick=retry}
  finally{open.disabled=false}
 };
 const toggle=open.onclick;function retry(){results.hidden=true;open.onclick=toggle;return toggle()}
 panel.append(heading,el('p','生日主題音樂'),audio,el('p','依臺北時間與會員的生日祝福資格列出。'),open,results);return panel;
}
class ThemeManager extends HTMLElement{
 connectedCallback(){if(this.childElementCount)return;
 const details=el('details'),title=el('summary','主題管理'),intro=el('p','使用臺北時間。未上架節慶時使用經典。開始留白表示立即，結束留白表示持續上架。'),out=el('div'),status=el('p');status.setAttribute('role','status');details.className='card';details.append(title,intro,birthdayPreview(),out,status);this.append(details);
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
