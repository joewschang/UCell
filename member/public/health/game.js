import {el,box,btn,link,apiFor,page,show} from './ui.js';
const member=!!sessionStorage.getItem('ucell_member_token');
const api=apiFor(member?'member':'public');
const params=new URLSearchParams(location.search);
const titles=['小腿指環觀察','五次坐站觀察','靠牆與身高觀察','年齡與體重試算'];
const prompts=['坐穩後，用雙手拇指與食指圍成圈，輕輕套在小腿最粗處，看看手指的位置。','把穩固無輪的椅子靠牆放好。如果平常能安全起身，可雙手抱胸，依自己的速度站直再坐下，共五次。','自然站好，看看後腦能否輕鬆靠牆，再回想與過去實測身高相比有沒有變化。','本試算採用台灣骨鬆學會列出的停經後婦女 OSTAi 公式。其他人可以略過，照樣完成本週觀察。'];
const options=[['手指圈合不起來','兩手指剛好相碰','圈好後仍有空隙','略過這項觀察'],['自行完成五次','需要用手支撐或中途停下','今天不適合做，略過'],['後腦可輕鬆靠牆','後腦無法輕鬆靠牆','無法確認或略過'],['與先前實測接近','比先前實測矮','沒有舊紀錄或不確定']];
const source='https://www.toa1997.org.tw/calculator/';
let data,step=0,answers=[],age='',weight='',eligible=null,seconds=null,startAt=null,timer=null,pending=false;
function clearTimer(){clearInterval(timer);timer=null;startAt=null;window.speechSynthesis?.cancel();}
function present(...nodes){clearTimer();show(...nodes);}
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
function home(){
 const count=data.weeks?.length||0;
 present(box('section','hero',el('small','本週健康任務　／　四站觀察'),el('h1','居家腿力與骨骼自我觀察'),el('p','準備一張穩固的椅子，跟著圖解看看自己的腿力與體態。每站都可以略過。'),btn('開始四站觀察 →',begin,'primary')),
 box('section','',el('h2','我的觀察護照'),el('p',member?'已完成 '+count+' 個不同週次。完成本週四站可收集一枚印章，累積三週取得「持續觀察家」。':'訪客可直接體驗；從會員中心登入後參加，即可累積每週印章。'),...(count?[el('span',count>=3?'✦ 持續觀察家':'✧ 居家觀察家','badge')]:[])),
 box('section','',el('h2','四站路線'),...titles.map((t,i)=>el('p',String(i+1).padStart(2,'0')+'　'+t))),related('game'));
}
async function begin(){
 if(pending)return;pending=true;
 try{if(member)await api('/start','POST');step=0;answers=[];age='';weight='';eligible=null;seconds=null;station();}
 catch(e){error(e,begin);}finally{pending=false;}
}
function error(e,retry){present(el('h1','健康中心'),el('p',e.message,'notice'),btn('再試一次',retry),link('返回探索','/explore'));}
function pick(list,i,refresh){
 const group=el('div',null,'choices');
 list.forEach((v,j)=>{const b=btn(v,()=>{answers[i]=j;refresh();});b.setAttribute('aria-pressed',String(answers[i]===j));group.append(b);});
 return group;
}
function score(){if(!eligible||!/^\d{1,3}$/.test(age)||Number(age)<18||Number(age)>120||!Number.isFinite(+weight)||+weight<=0||+weight>400)return null;
 const raw=(Number(weight)-Number(age))*0.2;
 return Math.sign(raw)*Math.round(Math.abs(raw)+1e-10)||0;
}
function scoreLabel(){const n=score();return n===null?'這次略過試算':('OSTAi '+n+' · '+(n< -1?'達到學會篩檢提醒門檻，可與醫師討論骨密度檢查。':'未達這項工具的提醒門檻，仍請配合個人病史判讀。'));}
function station(){
 const panel=el('section');const progress=el('progress');progress.max=4;progress.value=step+1;progress.setAttribute('aria-label','第 '+(step+1)+' 站，共四站');
 const heading=el('h1',titles[step]);panel.append(el('div','第 '+(step+1)+'／4 站','step'),progress,heading,el('p',prompts[step]));
 if('speechSynthesis'in window)panel.append(btn('朗讀本題',()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(titles[step]+'。'+prompts[step]);u.lang='zh-TW';u.rate=.85;speechSynthesis.speak(u);}));
 if(step<3){const img=el('img',null,'art');img.src='./step'+(step+1)+'.svg';img.alt=['手指圍住小腿最粗處的示意','從坐穩到站直的動作示意','自然站在牆旁的姿勢示意'][step];panel.append(img);}
 const next=btn(step===3?'完成觀察，查看紀錄':'確認，下一站 →',async()=>{if(step<3){step++;station();}else await finish();},'primary');
 function update(){next.disabled=step<2?answers[step]==null:step===2?answers[2]==null||answers[3]==null:eligible===null||(eligible&&score()===null);}
 if(step===1){
   panel.append(el('p','不穩、疼痛或頭暈時請停止。可以略過，也能取得印章。','notice'));
   const time=el('output',seconds==null?'可選用計時器':seconds+' 秒');
   const b=btn('開始計時',()=>{if(startAt===null){startAt=Date.now();b.textContent='停止計時';timer=setInterval(()=>time.textContent=((Date.now()-startAt)/1000).toFixed(1)+' 秒',200);}else{seconds=((Date.now()-startAt)/1000).toFixed(1);clearTimer();time.textContent=seconds+' 秒';b.textContent='重新計時';}});
   panel.append(box('div','row',b,time));
 }
 if(step<3){panel.append(el('h2',step===2?'靠牆時的感覺':'這次觀察到什麼？'),pick(options[step],step,station));
 if(step===2)panel.append(el('h2','和過去實測身高相比'),pick(options[3],3,station));}
 else{
 const yes=btn('我是停經後婦女，試算看看',()=>{eligible=true;station();});const no=btn('不適用或略過試算',()=>{eligible=false;station();});
 yes.setAttribute('aria-pressed',String(eligible===true));no.setAttribute('aria-pressed',String(eligible===false));panel.append(box('div','choices',yes,no));
 if(eligible){
 const preview=el('p',score()===null?'請輸入實際年齡和體重。':scoreLabel(),'notice');
 for(const [text,val,save] of [['足歲',age,v=>age=v],['體重（公斤）',weight,v=>weight=v]]){
 const field=el('input');field.type='number';field.value=val;field.step=text==='足歲'?'1':'0.1';field.oninput=()=>{save(field.value);preview.textContent=score()===null?'請確認年齡與體重。':scoreLabel();update();};panel.append(box('label','',text,field));}
 panel.append(preview,link('查看學會公式與適用對象',source));
 }}
 update();panel.append(box('div','row',btn(step?'上一站':'回任務首頁',()=>{if(step){step--;station();}else home();}),next));present(panel);
}
async function finish(){
 if(pending)return;pending=true;
 try{if(member){await api('/finish','POST');data=await api('');}report();}catch(e){error(e,finish);}finally{pending=false;}
}
function report(){
 const lines=[options[0][answers[0]],options[1][answers[1]]+(seconds!==null&&answers[1]===0?'（'+seconds+' 秒）':''),options[2][answers[2]]+'；'+options[3][answers[3]],scoreLabel()];
 const message='一起來 UCell 玩四站居家腿力與骨骼觀察！ '+location.origin+'/health/';
 const save=btn('下載我的完成卡',()=>{
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=620;const c=canvas.getContext('2d');c.fillStyle='#173f35';c.fillRect(0,0,960,620);c.fillStyle='#edd48c';c.font='bold 46px sans-serif';c.fillText('UCell　健康中心',64,105);c.fillStyle='white';c.font='bold 60px sans-serif';c.fillText('居家觀察家',64,280);c.font='34px sans-serif';c.fillText('我完成了腿力與骨骼四站觀察',64,385);c.fillText('邀你也來完成自己的健康任務',64,455);const a=link('',canvas.toDataURL('image/png'));a.download='UCell-居家觀察完成卡.png';a.click();});
 present(box('section','hero',el('small','四站任務完成'),el('h1','你的居家觀察紀錄'),el('p',member?'本週印章已收進會員護照。同週重玩仍保留一枚。':'你已完成訪客體驗。'),el('span','✦ 居家觀察家','badge')),
 box('section','',el('h2','這一次，你觀察到'),...lines.map((v,i)=>box('div','',el('h3',titles[i]),el('p',v))),el('p','若起身變得吃力、身高改變或持續背痛，可把變化與發生時間帶去看診。','notice')),
 box('section','',el('h2','邀家人一起觀察'),el('p','邀請與完成卡只包含任務名稱。你的答案、體重與試算值留在這次畫面。'),box('div','row',link('用 LINE 邀請家人','https://line.me/R/msg/text/?'+encodeURIComponent(message),'action'),save)),
 related('game'),btn('回健康護照',home));
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
