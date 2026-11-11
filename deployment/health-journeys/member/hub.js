import {el,box,btn,link,show} from '../ui.js';
import {api,member,login} from './session.js';
const params=new URLSearchParams(location.search);
function reminder(){
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10).replaceAll('-','');
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//UCell//Health//ZH','BEGIN:VEVENT','UID:health-weekly@ucell.life','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+date,'RRULE:FREQ=WEEKLY','SUMMARY:回健康中心選一項任務','URL:https://member.ucell.life/health/','END:VEVENT','END:VCALENDAR'];
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));const a=link('',url);a.download='UCell健康任務.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function home(){
 try{
  let claimed='';
  if(member&&params.has('passport')){
    const data=JSON.parse(sessionStorage.getItem('ucell.health.claim')||'null');
    if(data&&data.expires>Date.now()){
      const {game,attempt,visitor}=data;try{await api('/journey/claim','POST',{game,attempt,visitor});claimed='本週印章已收進健康護照。';sessionStorage.removeItem('ucell.health.claim');}catch(e){claimed='領章尚未完成。'+e.message;}
    }
  }
  const {games,passport}=await api('/journey');document.title='健康中心｜UCell 會員探索';document.body.classList.add('j-page');document.querySelector('main').classList.add('j-wrap');
  const week=Math.floor((Date.now()+8*3600000+3*86400000)/(7*86400000));const featured=games.length?games[week%games.length].id:'';
  const cards=games.map(g=>{
    const img=el('img');img.src=g.cover;img.width=640;img.height=360;img.alt='';
    const url=new URL(g.href,location.origin);if(params.get('invite'))url.searchParams.set('invite',params.get('invite'));
    const a=g.membersOnly&&!member?login(url.pathname+url.search):link(g.id==='egfr'?'開始換算':'開始觀察',url.href,'j-primary');
    a.setAttribute('aria-label',a.textContent+'：'+g.name);
    return box('article','j-tile',img,box('div','j-pad',g.id===featured?el('small','本週任務','j-week'):null,el('h2',g.name),el('p',g.description),a));
  });
  const records=(passport||[]).filter(p=>p.n);
  const names={game:'肌少症',diabetes:'糖尿病',egfr:'eGFR','blood-pressure':'血壓監測',cognition:'認知觀察'};
  const topics=el('nav');topics.id='journey-topics';topics.setAttribute('aria-label','依標籤探索');
  show(box('div','j-heading',el('small','會員探索 ／ 健康中心'),el('h1','今天想了解什麼？'),el('p','選一個生活主題開始，也可以邀家人一起體驗。')),
    cards.length?box('div','j-grid',...cards):el('p','目前沒有開放的健康任務。'),
    box('section','j-panel',el('h2','我的健康護照'),claimed?el('p',claimed):null,member?(records.length?box('ul','j-stamps',...records.map(p=>el('li',names[p.id]+'　'+p.n+' 枚週章 · 最近完成 '+p.latest))):el('p','完成一項任務，收集第一枚週章。')):box('div','',el('p','訪客可直接玩，登入後完成任務即可收集週章。'),login('/health/')),
    box('details','',el('summary','設定每週行事曆提醒'),el('p','將每週任務加入個人行事曆，之後可在行事曆調整或取消。'),btn('下載行事曆提醒',reminder))),topics);
 }catch(e){show(el('h1','健康中心'),el('p',e.message),btn('重新載入',home));}
}
if(['play','game','from','read','tag'].some(k=>params.has(k)))await import('../sarcopenia.js?journey=1');else home();
