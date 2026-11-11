import {el,box,btn,link,show,apiFor} from '../ui.js';
import {stations,skip,summarize} from './stations.js';

const title = '糖尿病自我檢測';
const member = !!sessionStorage.getItem('ucell_member_token');
const api = apiFor(member ? 'member' : 'public');
let answers = [], step = 0, busy = false;
const page = (...nodes) => {window.speechSynthesis?.cancel(); show(...nodes);};
const section = (heading,...nodes) => box('section','',el('h2',heading),...nodes);
const reference = 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=5020&pid=20237';

function picture(index) {
  const img = el('img');
  img.src = './images/station-'+(index+1)+'.jpg';
  img.alt = stations[index].title+'圖解'; img.width=1280; img.height=720;
  return img;
}
async function home(){
  try {
    const data = await api('/diabetes');
    if (!data.open) {page(el('h1','本遊戲暫停開放'),link('返回健康中心','../')); return;}
    page(box('section','intro',box('div','intro-content',el('small','UCell 健康中心 · 生活觀察'),el('h1',title),
      el('p','最近更容易口渴嗎？平常一週走動多久？跟著六張圖，整理自己想留意的變化。'),btn('開始六題觀察',begin,'primary')),picture(0)),
      section('怎麼玩',el('p','每題選擇最接近平常的情況。不清楚時可以略過，也可以回上一題修改。'),
        box('ol','route',...stations.map(s=>el('li',s.title))),el('p','本遊戲供成人自我觀察。是否患有糖尿病，需要由醫療人員透過血液檢查判定。')),
      section('我的健康護照',el('p',member?'已收集 '+data.weeks+' 枚本遊戲的每週印章。':'訪客也可以玩。會員完成後，每週可收集一枚本遊戲印章。'),
        el('small','答案僅在本頁暫存，離開後即清除。')),link('返回健康中心','../'));
  } catch (e) {page(el('h1',title),el('p',e.message),btn('重新載入',home),link('返回健康中心','../'));}
}
async function begin(e){
  if(busy)return;
  busy=true; e.currentTarget.disabled=true;
  try {
    if(member) await api('/diabetes/start','POST');
    answers=[];step=0;station();
  } catch(error) {page(el('h1',title),el('p',error.message),btn('重新開始',begin),link('返回健康中心','../'));}
  finally{busy=false;}
}
function station(){
  const s=stations[step], panel=el('section');
  const progress=el('progress'); progress.max=6;progress.value=step+1;progress.setAttribute('aria-label','答題進度');
  const dialog=el('dialog');dialog.setAttribute('aria-label',s.title+'放大圖解');
  dialog.append(btn('關閉圖解',()=>dialog.close()),picture(step));
  const photo=btn('',()=>dialog.showModal(),'photo');photo.append(picture(step),el('span','放大圖解'));
  panel.append(el('small',title+' · 第 '+(step+1)+' 題，共 6 題'),progress,el('h1',s.title),el('p',s.prompt),photo,dialog);
  if(s.note)panel.append(el('p',s.note,'note'));
  if(window.speechSynthesis && window.SpeechSynthesisUtterance){
    panel.append(btn('朗讀題目與選項',()=>{
      speechSynthesis.cancel();
      const spoken=new SpeechSynthesisUtterance([s.title,s.prompt,s.note,...s.choices,skip].filter(Boolean).join('。'));
      spoken.lang='zh-TW';spoken.rate=.85;speechSynthesis.speak(spoken);
    }));
  }
  const choices=el('div',null,'choices');
  choices.setAttribute('role','group');choices.setAttribute('aria-label','你的情況');
  const next=btn(step===5?'查看我的結果':'下一題',()=>{if(step===5)report();else{step++;station();}},'primary');
  next.disabled=answers[step]===undefined;
  [...s.choices,skip].forEach((label,i)=>{
    const choice=btn(label,()=>{
      answers[step]=i;
      for(const b of choices.children)b.setAttribute('aria-pressed',String(b===choice));
      next.disabled=false;
    });
    choice.setAttribute('aria-pressed',String(answers[step]===i));choices.append(choice);
  });
  panel.append(el('h2','你的情況'),choices,box('div','row',btn(step?'上一題':'回遊戲首頁',()=>{if(step){step--;station();}else home();}),next));
  page(panel);
}
function card(){
  const canvas=el('canvas');canvas.width=960;canvas.height=540;
  const c=canvas.getContext('2d');
  c.fillStyle='#103956';c.fillRect(0,0,960,540);c.fillStyle='#aadced';c.font='32px sans-serif';c.fillText('UCell 健康中心',64,92);
  c.fillStyle='#fff';c.font='bold 68px sans-serif';c.fillText(title,64,222);
  c.fillStyle='#f3d693';c.font='40px sans-serif';c.fillText('我完成了六站生活觀察',64,327);
  for(let i=0;i<6;i++){c.beginPath();c.arc(84+i*64,430,14,0,2*Math.PI);c.fill();}
  const a=link('',canvas.toDataURL('image/png'));a.download='UCell-糖尿病自我檢測完成卡.png';a.click();
}
function report(){
  const result=summarize(answers);
  const notes=result.advice.length?box('ul','record',...result.advice.map(([label,text])=>box('li','',el('strong',label),el('span',text)))):
    el('p',result.count?'持續留意自己的變化。即使沒有症狀，也可在健檢時詢問適合自己的血糖檢查。':'這次六題都略過了。可以先了解家族病史或量一次腰圍，再回來記錄。');
  const stamp=el('p',member?'正在領取本週印章…':'已完成訪客體驗。');stamp.setAttribute('role','status');
  const retry=btn('重新領取',claim);retry.hidden=true;
  async function claim(){
    retry.hidden=true;
    try{
      // Starting again is idempotent and handles crossing Taipei midnight on Sunday.
      await api('/diabetes/start','POST');await api('/diabetes/finish','POST');
      stamp.textContent='本週印章已收進健康護照。';
    }catch(e){stamp.textContent='印章尚未領取。'+e.message;retry.hidden=false;}
  }
  const shareText='我完成了 UCell 糖尿病自我檢測，邀你一起做六站生活觀察。 '+location.origin+'/health/diabetes/';
  page(box('section','intro',box('div','intro-content',el('small','六站完成 · 已回答 '+result.count+'／6 題'),el('h1',result.title),stamp,retry)),
    section('給你的健康建議',notes,el('p','這些生活觀察無法推算血糖或判定是否患病。若有持續不適，請向醫療人員說明。')),
    section('我的六題紀錄',box('ol','record',...stations.map((s,i)=>box('li','',el('strong',(i+1)+'. '+s.title),el('span',s.choices[answers[i]]??'已略過'))))),
    section('分享完成卡',el('p','分享內容只顯示完成遊戲。'),box('div','row',btn('儲存完成卡',card),link('邀 LINE 好友體驗','https://line.me/R/msg/text/?'+encodeURIComponent(shareText),'action'))),
    section('延伸閱讀',box('div','links',link('國民健康署 · 腰圍與身體活動',reference),link('美國 CDC · 糖尿病檢查（英文）','https://www.cdc.gov/diabetes/diabetes-testing/'),link('探索血糖健康主題','/topics/?tag='+encodeURIComponent('血糖健康')))),
    box('div','row',link('返回健康中心','../'),btn('再玩一次',home)));
  if(member)claim();
}
home();
