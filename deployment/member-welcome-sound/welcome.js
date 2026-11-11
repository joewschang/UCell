const preference='ucell.line-welcome-sound.v1',playedKey='ucell.line-welcome-played.v1';
const clip='/welcome-sound/ucell-welcome.wav';
let muted=false,initialized=false,pending=false,played=false,player,preview,revision=0;
try{muted=localStorage.getItem(preference)==='off';}catch{}
function stopPending(){
 pending=false;
 document.removeEventListener('click',gesture,true);
 document.removeEventListener('keydown',gesture,true);
}
function cancel(){
 revision++;stopPending();player?.pause();
}
function setEnabled(on){
 muted=!on;
 try{localStorage.setItem(preference,on?'on':'off');}catch{}
 if(muted){cancel();preview?.pause();}
}
function gesture(event){
 if(!event.isTrusted||event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
 if(event.target?.closest?.('uc-welcome-sound'))return;
 if(pending)attempt(false);
}
function attempt(automatic){
 if(muted||played||document.hidden)return;
 stopPending();
 const ticket=++revision;
 player??=new Audio(clip);
 player.play().then(()=>{
  if(ticket!==revision)return;
  played=true;
  try{sessionStorage.setItem(playedKey,'1');}catch{}
 }).catch(error=>{
  if(ticket!==revision||muted||!automatic||error.name!=='NotAllowedError'||document.hidden)return;
  pending=true;
  document.addEventListener('click',gesture,true);
  document.addEventListener('keydown',gesture,true);
 });
}
export function enterMemberCenter(inLine){
 if(initialized||!inLine)return;
 initialized=true;
 const nav=performance.getEntriesByType('navigation')[0]?.type;
 let fromInside=false;
 try{fromInside=!!document.referrer&&new URL(document.referrer).origin===location.origin;}catch{}
 let previous=false;try{previous=sessionStorage.getItem(playedKey)==='1';}catch{}
 if((previous&&(nav==='reload'||nav==='back_forward'||fromInside))||muted)return;
 if(document.hidden){
  const onVisible=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',onVisible);attempt(true);}};
  document.addEventListener('visibilitychange',onVisible);
 }else attempt(true);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();preview?.pause();}});
window.addEventListener('pagehide',()=>{cancel();preview?.pause();});
window.addEventListener('storage',event=>{
 if(event.key!==preference)return;
 muted=event.newValue==='off';if(muted){cancel();preview?.pause();}
 document.querySelectorAll('uc-welcome-sound').forEach(el=>el.refresh());
});
class WelcomeSound extends HTMLElement{
 connectedCallback(){
  if(this.children.length){this.refresh();return;}
  const label=document.createElement('label');
  this.toggle=document.createElement('input');this.toggle.type='checkbox';
  this.toggle.onchange=()=>setEnabled(this.toggle.checked);
  label.append(this.toggle,' LINE 迎賓音');
  const note=document.createElement('p');note.textContent='從 LINE 進入會員中心時播放。此設定儲存在這台裝置。';
  const sample=document.createElement('button');sample.type='button';sample.textContent='試聽迎賓音';
  const feedback=document.createElement('span');feedback.setAttribute('role','status');
  sample.onclick=()=>{
   cancel();preview??=new Audio(clip);preview.currentTime=0;
   preview.play().then(()=>{feedback.textContent='';}).catch(()=>{feedback.textContent='暫時無法播放，請再試一次。';});
  };
  this.append(label,note,sample,feedback);this.refresh();
 }
 refresh(){if(this.toggle)this.toggle.checked=!muted;}
}
customElements.define('uc-welcome-sound',WelcomeSound);
