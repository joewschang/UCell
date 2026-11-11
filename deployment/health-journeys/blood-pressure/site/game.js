import {session} from '../journey/session.js';

const main=document.querySelector('main');
const viewer=document.querySelector('#viewer');
const steps=[
  ['systolic','讀收縮壓','找到血壓計第一行 SYS，輸入這一次的高壓。'],
  ['diastolic','讀舒張壓','找到同一次量測的第二行 DIA，輸入低壓。'],
  ['pulse','算脈壓差','用同一筆收縮壓減去舒張壓，選出正確答案。'],
  ['posture','練習 722 量測','您平常怎麼量血壓？'],
  ['symptoms','留意身體訊號','您現在有以下哪種情形？'],
  ['habits','觀察飲食與家族史','分別選擇最接近自己情況的一項。']
];
let step=0, demo=false, answers={}, journey;
const emergency='若現在胸痛、呼吸困難、突然單側無力、說話不清或視力改變，請立即撥 119。';
const severe='請安靜坐好，至少隔 1 分鐘再量一次。若收縮壓仍達 180 或舒張壓仍達 120 mmHg，請立即聯絡醫療人員。';
const habit=['連續七天，早晚各量兩次','偶爾量，還沒有固定時間','目前沒有量測習慣'];
const symptom=['目前沒有明顯不適','有頭暈或頭痛等不適','現在胸痛、呼吸困難，或突然單側無力、說話不清、視力改變'];
const salt=['通常清淡，少喝湯、少沾醬','常吃偏鹹、加工食品或喝濃湯','還不確定'];
const family=['家人有高血壓或中風病史','沒有已知家族史','還不清楚'];
function e(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n}
function button(text,action,cls){const n=e('button',text,cls);n.type='button';n.onclick=action;return n}
function link(text,url){const a=e('a',text);a.href=url;return a}
function image(key,alt){const i=e('img');i.src='images/'+key+'.jpg';i.alt=alt;i.width=1280;i.height=720;return i}
function art(key,title){const b=button('',()=>{const i=viewer.querySelector('img');i.src='images/'+key+'.jpg';i.alt=title;viewer.showModal()},'art');b.append(image(key,title),e('span','放大圖卡'));return b}
function layout(title,caption){
  window.speechSynthesis?.cancel();const card=e('section',null,'card'),body=e('div',null,'pad');
  const heading=e('h1',title);heading.tabIndex=-1;body.append(e('small',caption),heading);card.append(body);main.replaceChildren(card);heading.focus();return body;
}
function start(sample){demo=sample;step=0;answers={};journey.start();station()}
function home(){
 const body=layout('血壓監測','UCell 健康中心');body.parentElement.prepend(image('posture','居家量測姿勢與 722 原則'));body.parentElement.firstChild.className='cover';
 body.append(e('p','拿出一筆成人居家血壓讀值，用六張圖練習讀懂高壓、低壓與脈壓差。手邊沒有血壓計，也可以用範例玩。','intro'));
 const row=e('div',null,'actions');row.append(button('使用我的讀值',()=>start(false),'primary'),button('用範例練習',()=>start(true)));body.append(row,e('p',emergency),e('small','適用一般成人。孕產婦與兒童請依醫療團隊提供的量測指引。'));
}
function alertBox(text){const n=e('div',null,'urgent');n.setAttribute('role','alert');n.append(e('p',text),e('p',emergency),link('撥打 119','tel:119'));return n}
function group(host,label,key,choices,onChange){
 const box=e('div',null,'choices');box.setAttribute('role','group');box.setAttribute('aria-label',label);
 box.append(e('strong',label));const buttons=choices.map((choice,i)=>button(String(choice),()=>{
  answers[key]=i;buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));onChange();
 }));
 buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(answers[key]===i));box.append(b)});host.append(box);
}
function goBack(){if(step===0){home();return}step--;station()}
function station(){
 const [key,title,desc]=steps[step], body=layout(title,(demo?'範例練習':'我的讀值')+'　·　第 '+(step+1)+' / 6 關');
 const progress=e('progress');progress.max=6;progress.value=step+1;progress.setAttribute('aria-label','關卡進度');body.append(progress,art(key,title),e('p',desc,'intro'));
 const fields=e('div'),status=e('div');status.setAttribute('aria-live','polite');body.append(fields,status);
 const message=text=>status.replaceChildren(e('p',text,'feedback'));
 const navigate=()=>{if(step===5){report();return}step++;station()};
 let next=navigate;
 if(step<2){
  const sys=step===0, label=e('label',sys?'收縮壓 SYS（mmHg）':'舒張壓 DIA（mmHg）'), input=e('input');input.id='reading';input.type='number';input.inputMode='numeric';input.step='1';label.htmlFor=input.id;
  input.value=answers[key]??(demo?(sys?120:78):'');fields.append(label,input);
  if(demo)fields.append(e('small',' 範例血壓為 120／78 mmHg。'));
  input.oninput=()=>{answers[key]=input.value;status.replaceChildren()};
  next=()=>{const n=input.valueAsNumber;if(!Number.isInteger(n)||n<=0||n>999){message('請輸入血壓計上大於零的整數。');input.focus();return}
   if(!sys&&n>=Number(answers.systolic)){message('低壓應小於高壓，請核對 SYS 與 DIA。');return}
   answers[key]=String(n);
   if(n>=(sys?180:120)){status.replaceChildren(alertBox(severe));status.append(button('已閱讀提醒，繼續',navigate));return}navigate()};
 }else if(step===2){
  const diff=answers.systolic-answers.diastolic,opts=[diff+10,diff,diff+5];fields.append(e('p',answers.systolic+' − '+answers.diastolic+' = ？ mmHg','metric'));
  group(fields,'脈壓差（mmHg）','pulseChoice',opts,()=>message(answers.pulseChoice===1?'答對了！把差值與多次量測紀錄一起看。':'再試一次，用高壓減去低壓。'));
  next=()=>answers.pulseChoice===1?navigate():message('請先選出高壓減低壓的差值。');
 }else if(step===3){
  group(fields,'量測習慣','habit',habit,()=>message('連續 7 天、早晚各 1 回，每回量 2 次，間隔至少 1 分鐘。'));
  next=()=>answers.habit===undefined?message('請選擇一項量測習慣。'):navigate();
 }else if(step===4){
  group(fields,'目前的感受','symptom',symptom,()=>{status.replaceChildren();if(answers.symptom===2)status.append(alertBox('請先停止遊戲，立即求助。'));else message(answers.symptom===1?'記錄不適發生時間。如持續或反覆出現，請就醫評估。':'高血壓常沒有明顯症狀，仍要規律量測。')});
  next=()=>{if(answers.symptom===2){status.replaceChildren(alertBox('請先停止遊戲，立即求助。'));return}if(answers.symptom===undefined){message('請選擇目前的感受。');return}navigate()};
 }else{
  group(fields,'平日飲食','salt',salt,()=>status.replaceChildren());group(fields,'家族病史','family',family,()=>status.replaceChildren());
  next=()=>answers.salt!==undefined&&answers.family!==undefined?navigate():message('請各選一項飲食習慣和家族病史。');
 }
 const row=e('div',null,'actions');row.append(button('上一步',goBack),button(step===5?'查看結果':'下一步',()=>next(),'primary'));
 if(window.speechSynthesis){row.append(button('朗讀這一關',()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance([title,desc,fields.innerText,status.innerText].join('。'));u.lang='zh-TW';u.rate=.85;speechSynthesis.speak(u)}))}
 body.append(row);
}
function downloadCard(){
 const c=document.createElement('canvas');c.width=1000;c.height=600;
 const ctx=c.getContext('2d');ctx.fillStyle='#103b38';ctx.fillRect(0,0,1000,600);ctx.strokeStyle='#d9c183';ctx.lineWidth=3;ctx.strokeRect(30,30,940,540);
 ctx.textAlign='center';ctx.fillStyle='#f6e2ae';ctx.font='30px sans-serif';ctx.fillText('UCell  健康中心',500,155);ctx.fillStyle='white';ctx.font='bold 64px sans-serif';ctx.fillText('血壓監測完成卡',500,280);ctx.font='34px sans-serif';ctx.fillText('已完成六關居家量測練習',500,370);ctx.font='27px sans-serif';ctx.fillText(new Date().toLocaleDateString('zh-TW'),500,465);
 const a=link('',c.toDataURL('image/png'));a.download='UCell-血壓監測完成卡.png';a.click();
}
async function report(){
 const body=layout('讀值與下一步',demo?'範例練習結果':'本次居家觀察');
 const sys=Number(answers.systolic),dia=Number(answers.diastolic);const metrics=e('div',null,'metric');
 metrics.append(e('strong',sys+'／'+dia+' mmHg'),e('span','本次脈壓差　'+(sys-dia)+' mmHg'));body.append(metrics);
 if(sys>=180||dia>=120)body.append(alertBox(severe));
 else if(sys<90||dia<60)body.append(e('p','本次有較低的讀值。請記下量測時間及不適；若持續偏低或頭暈，請聯絡醫療人員。'));
 if(sys>=130||dia>=80)body.append(e('p','本次收縮壓達 130 或舒張壓達 80 mmHg。請依 722 原則記錄多天讀值，帶紀錄與醫師討論。'));
 else if(sys>=90&&dia>=60)body.append(e('p','本次讀值低於 130／80 mmHg。請繼續觀察不同日子的變化。'));
 body.append(e('p','單次讀值無法確診高血壓，脈壓差也無法單獨判定血管硬化。'));
 const tips=e('ul');for(const tip of [
 answers.habit===0?'保留早晚量測紀錄，回診時帶上。':'從一個固定時段開始，量前安坐五分鐘，背靠椅背、雙腳平放、手臂與心臟同高。',
 answers.salt===1?'下一餐先少沾一次醬，湯品少喝湯汁。':'留意醬料、加工食品和湯品的鹽分。',
 answers.family===0?'將家人的高血壓或中風病史一併告知醫師。':null,
 answers.symptom===1?'將不適發生時間與血壓記在一起；症狀持續或反覆請就醫。':null
 ].filter(Boolean))tips.append(e('li',tip));body.append(e('h2','接下來可以做的事'),tips);
 const log=link('下載 7 天早晚血壓紀錄表','722.csv');log.download='UCell-722血壓紀錄.csv';body.append(log);
 body.append(e('h2','完成六關練習'),button('下載完成卡',downloadCard),e('p','完成卡與分享邀請只顯示任務名稱，不含個人讀值或答案。'));
 const stamp=e('p');stamp.setAttribute('role','status');body.append(stamp);async function claim(){stamp.textContent='正在記錄完成進度…';const ok=await journey.finish();stamp.textContent=ok?(journey.member?'本週印章已收進健康護照。':'登入後可領取本週印章。'):'暫時無法記錄完成進度。';if(!ok)stamp.append(button('重試',claim))}
 claim();body.append(journey.sharing(),journey.explore(),button('重新練習',home));
 const sources=e('footer',null,'sources');sources.append('量測依據　',link('台灣高血壓學會','https://www.ths.org.tw/about/2'),'　',link('緊急警訊說明','https://www.heart.org/en/health-topics/high-blood-pressure/know-your-risk-factors-for-high-blood-pressure/what-are-the-symptoms-of-high-blood-pressure'));body.append(sources);
}
const pref=localStorage.getItem('ucell.ui-theme-preference.v1');
document.documentElement.classList.toggle('dark',pref==='DARK'||(pref!=='LIGHT'&&matchMedia('(prefers-color-scheme:dark)').matches));
document.querySelector('#large').onclick=event=>event.currentTarget.setAttribute('aria-pressed',String(document.documentElement.classList.toggle('large')));
journey=await session('blood-pressure');main.removeAttribute('aria-busy');if(journey)home();
