import {taipeiDay,isBirthday} from './date.js';
const welcome="平常總惦記著別人的您，今天也值得被好好惦記。謝謝您把生活的一小部分交給 UCell 陪伴。願新的一歲，有人聽您慢慢說話，有件小事讓您真心期待，也有足夠的時間，過自己喜歡的日子。";
let identity,day,promise,profile,playing,card;
const pref='ucell.line-welcome-sound.v1';
function stop(){playing?.pause();playing=null;card?.remove();card=null}
function reset(){stop();profile=null;delete document.documentElement.dataset.birthday;document.querySelectorAll('uc-birthday-wish').forEach(el=>el.refresh())}
function enabled(){return localStorage.getItem(pref)!=='off'}
async function music(){if(!enabled()||!profile)return;playing??=new Audio('/birthday/v1/chime.wav');try{await playing.play()}catch{}}
function intro(){
 const key='ucell.birthday.'+profile.memberNo+'.'+day;if(localStorage.getItem(key))return;
 localStorage.setItem(key,'1');card=document.createElement('aside');card.className='birthday-card';card.setAttribute('aria-label','生日賀卡');
 const star=document.createElement('span');star.className='birthday-candles';star.textContent='🕯️';star.setAttribute('aria-hidden','true');
 const heading=document.createElement('strong');heading.textContent=(profile.alias||profile.name||'親愛的會員')+'，生日快樂';
 const note=document.createElement('p');note.textContent='今天，請為自己許一個願。';
 const close=document.createElement('button');close.textContent='收下祝福';close.onclick=stop;
 card.append(star,heading,note);
 if(enabled()){const replay=document.createElement('button');replay.textContent='播放生日樂音';replay.onclick=music;card.append(replay)}
 card.append(close);document.body.append(card);music();const current=card;setTimeout(()=>{if(card===current)stop()},10000);
}
export function check(){
 const token=sessionStorage.getItem('ucell_member_token'),today=taipeiDay();
 if(token===identity&&day===today)return promise;
 reset();identity=token;day=today;
 promise=token?fetch((location.hostname==='member.ucell.life'?'https://api.ucell.life':'')+'/api/v1/member/me',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(7000)}).then(r=>r.ok?r.json():null).then(raw=>{
 if(identity!==token||day!==today||!raw||!isBirthday(raw.data?.birthDate,today))return false;
 profile=raw.data;document.documentElement.dataset.birthday='yes';document.querySelectorAll('uc-birthday-wish').forEach(el=>el.refresh());intro();return true;
 }).catch(()=>{if(identity===token)identity=undefined;return false}):Promise.resolve(false);
 return promise;
}
class Wish extends HTMLElement{
 connectedCallback(){this.refresh();check()}
 refresh(){this.replaceChildren();if(!profile)return;const h=document.createElement('h1'),p=document.createElement('p');h.textContent=(profile.alias||profile.name||'親愛的會員')+'，生日快樂';p.textContent=welcome;this.append(h,p)}
}
customElements.define('uc-birthday-wish',Wish);
setInterval(()=>{if(!document.hidden)check()},10000);
addEventListener('pageshow',check);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else check()});
check();
