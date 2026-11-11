import {el,box,btn,link,show,apiFor} from './ui.js';
import {stations,title,summarize} from './stations.js';
const member=!!sessionStorage.getItem('ucell_member_token');
const api=apiFor(member?'member':'public');
const params=new URLSearchParams(location.search);
let data,step=0,answers=[],busy=false,timer,started,seconds;
function stop(){clearInterval(timer);started=null;window.speechSynthesis?.cancel()}
function present(...nodes){stop();show(...nodes)}
function related(id){
 const origin=data.resources.find(r=>r.id===id);
 if(!origin)return null;
 const peers=data.resources.filter(r=>r.id!==id&&r.tags.some(t=>origin.tags.includes(t)));
 return box('section','',el('h2','沿著標籤探索'),box('div','row',...origin.tags.map(t=>link('#'+t,'?tag='+encodeURIComponent(t),'pill'))),box('div','links',...peers.map(r=>link(r.kind+' · '+r.title,r.href))));
}
function library(tag){
 const rows=data.resources.filter(r=>r.tags.includes(tag));
 present(link('‹ 健康中心','./'),el('h1','#'+tag),box('section','links',...rows.map(r=>link(r.kind+' · '+r.title,r.href))));
}
const guides={
 guide:['觀察前，先準備椅子和空間','找一張穩固無輪的椅子，靠牆放好，移開腳邊雜物。平常起身需要協助時，可以只閱讀圖解或邀家人陪同。','任何動作感到疼痛、頭暈或站不穩時，請停止，選擇略過。'],
 bone:['整理身高與回診問題','找出以前有日期的身高紀錄，和這次用同樣方式實測的數字放在一起。若不確定，直接選「沒有舊紀錄」。','若有身高明顯改變、持續背痛或骨折史，可把具體情況帶去與醫療人員討論。']};

function imageFor(i){
  const img=el('img');img.src='./images/station-'+(i+1)+'.jpg';img.alt=stations[i].title+'示範圖';img.width=1280;img.height=720;img.style.height='auto';return img;
}
function home(){
 const count=data.weeks?.length||0;
 present(box('section','hero',el('small','UCell 健康中心　／　居家觀察'),el('h1',title),el('p','從小腿、起身到日常行走，跟著六張圖，記下自己的肌力與行動變化。'),btn('開始六題檢測',begin,'primary')),
 box('section','',el('h2','六題怎麼玩'),el('p','每題選最接近平常情況的一項。不確定或不方便時可以略過。若疼痛、頭暈或不穩，請停止動作。'),box('ol','route-list',...stations.map(s=>el('li',s.title)))),
 box('section','',el('h2','我的健康護照'),el('p',member?'已累積 '+count+' 週印章，每週完成可收集一枚。':'訪客可直接體驗；會員登入後完成可收集本週印章。'),...(count>=3?[el('span','✦ 持續觀察家','badge')]:[])),related('game'));
}
async function begin(){
 if(busy)return;busy=true;
 try{if(member)await api('/start','POST');answers=[];seconds=null;step=0;station()}catch(e){error(e,begin)}finally{busy=false}
}
function error(e,retry){present(el('h1','健康中心'),el('p',e.message,'notice'),btn('再試一次',retry),link('返回探索','/explore'))}
function station(){
 const s=stations[step],panel=el('section'),progress=el('progress');
 progress.max=6;progress.value=step+1;progress.setAttribute('aria-label','第 '+(step+1)+' 題，共六題');
 panel.append(el('small','肌少症自我檢測　／　第 '+(step+1)+' 題，共 6 題','step'),progress,el('h1',s.title),el('p',s.prompt));
 const dialog=el('dialog');dialog.setAttribute('aria-label',s.title+'放大圖解');dialog.append(btn('關閉圖解',()=>dialog.close()),imageFor(step));
 const photo=btn('',()=>dialog.showModal(),'station-photo');photo.append(imageFor(step),el('span','放大圖解'));panel.append(photo,dialog);
 if(window.speechSynthesis)panel.append(btn('朗讀題目與選項',()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance([s.title,s.prompt,...s.choices].join('。'));u.lang='zh-TW';u.rate=.85;speechSynthesis.speak(u)}));
 if(step===1){
 const output=el('output',seconds==null?'':seconds+' 秒');
 const clock=btn('開始計時',()=>{if(started==null){started=Date.now();clock.textContent='停止計時';timer=setInterval(()=>output.textContent=((Date.now()-started)/1000).toFixed(1)+' 秒',200)}else{seconds=((Date.now()-started)/1000).toFixed(1);stop();output.textContent=seconds+' 秒';clock.textContent='重新計時'}});
 panel.append(box('div','row',clock,output));
 }
 const next=btn(step===5?'查看檢測結果':'下一題 →',()=>{if(step===5)finish();else{step++;station()}},'primary');
 next.disabled=answers[step]===undefined;
 const choices=el('div',null,'choices');
 [...s.choices,'不確定或略過這題'].forEach((label,i)=>{
 const choice=btn(label,()=>{answers[step]=i;for(const b of choices.children)b.setAttribute('aria-pressed',String(b===choice));next.disabled=false});
 choice.setAttribute('aria-pressed',String(answers[step]===i));choices.append(choice)});
 panel.append(el('h2','你的情況'),choices,box('div','row station-nav',btn(step?'上一題':'回任務首頁',()=>{if(step){step--;station()}else home()}),next));present(panel);
}
async function finish(){
 if(busy)return;busy=true;
 try{if(member){await api('/finish','POST');data=await api('')}report()}catch(e){error(e,finish)}finally{busy=false}
}
function card(){
 const canvas=el('canvas');canvas.width=960;canvas.height=540;const c=canvas.getContext('2d');
 c.fillStyle='#153e34';c.fillRect(0,0,960,540);c.fillStyle='#ecd395';c.font='bold 36px sans-serif';c.fillText('UCell　健康中心',64,100);c.fillStyle='#fff';c.font='bold 62px sans-serif';c.fillText(title,64,246);c.font='36px sans-serif';c.fillText('完成六站居家觀察',64,344);
 const a=link('',canvas.toDataURL('image/png'));a.download='UCell-肌少症自我檢測完成卡.png';a.click();
}
function report(){
 const summary=summarize(answers),message='邀你一起完成 UCell 肌少症自我檢測 '+location.origin+'/health/';
 present(box('section','hero',el('small','健康護照　／　六站走讀完成'),el('h1',summary.heading),el('p',member?'本週印章已收進健康護照。':'已完成本次訪客體驗。')),
 box('section','',el('h2','本次檢測結果'),el('p',summary.total===null?'已回答 '+summary.count+'／6 題':summary.total+'／100','result-score'),el('p',summary.total===null?'有略過的題目，本次只呈現已回答的觀察。':'這是本遊戲的觀察分數；肌少症診斷需要專業評估。')),
 box('section','',el('h2','給你的健康建議'),box('ul','result-lines',...(summary.advice.length?summary.advice:[summary.count?'持續留意日常起身與走路的變化；若比以前吃力，可帶著紀錄與醫療人員討論。':'可邀家人陪同，從最熟悉的日常活動開始觀察。']).map(t=>el('li',t))),link('五次坐站測試參考依據','https://pubmed.ncbi.nlm.nih.gov/32033882/')),
 box('section','',el('h2','六題觀察紀錄'),box('ol','result-lines',...stations.map((s,i)=>el('li',s.title+' · '+(s.choices[answers[i]]??'略過'))))),
 box('section','',el('h2','邀家人一起玩'),el('p','完成卡與邀請只分享任務名稱。'),box('div','row',btn('下載完成卡',card),link('用 LINE 邀請家人','https://line.me/R/msg/text/?'+encodeURIComponent(message),'action'))),related('game'),btn('回健康護照',home));
}
async function init(){
 try{data=await api('');if(!data.open){present(el('h1','健康任務暫停中'),link('返回探索','/explore'));return;}
 const id=params.get('read'),tag=params.get('tag'),from=params.get('from');
 if(id&&guides[id]&&Object.hasOwn(guides,id)){const [title,...paras]=guides[id];present(link('‹ 健康中心','./'),el('h1',title),box('section','',...paras.map(p=>el('p',p))),related(id));}
 else if(tag&&data.tags.includes(tag))library(tag);
 else if(from&&data.resources.some(r=>r.id===from))present(link('‹ 健康中心','./'),el('h1',data.resources.find(r=>r.id===from).title),related(from));
 else if(params.has('play'))await begin();else home();
 }catch(e){error(e,init);}
}
init();

