import { session } from '../journey/session.js';
import { questions } from './questions.js';

const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
const labels = ['有明顯改變', '沒有改變', '不知道／不適用'];
const hints = ['以前少見，或比以前更明顯', '和平常相同，或一直都是如此', '缺少觀察機會，難以比較'];
const source = 'https://health99.hpa.gov.tw/media/public/pdf/21659.pdf';
const answers = Array(questions.length).fill(null);
let position = 0, perspective = '', finished = false;
const theme = localStorage.getItem('ucell.ui-theme-preference.v1');
document.documentElement.classList.toggle('dark', theme === 'DARK' || (theme !== 'LIGHT' && matchMedia('(prefers-color-scheme:dark)').matches));
document.querySelector('#large').onclick = e => e.currentTarget.setAttribute('aria-pressed', String(document.documentElement.classList.toggle('large')));
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function button(label, action, cls) {
  const b = el('button', label, cls); b.type = 'button'; b.onclick = action; return b;
}
function link(label, href) {
  const a = el('a', label); a.href = href; return a;
}
function panel(title, kicker) {
  window.speechSynthesis?.cancel();
  const section = el('section', null, 'sheet');
  const body = el('div', null, 'content');
  const h = el('h1', title); h.tabIndex = -1;
  body.append(el('small', kicker), h); section.append(body); main.replaceChildren(section);
  window.scrollTo(0,0); h.focus({preventScroll:true}); return body;
}
function begin(who) {
  answers.fill(null); position = 0; finished = false; perspective = who;
  journey.start(); question();
}
function intro() {
  const body = panel('失智/輕度認知障礙評估', 'AD8® 認知篩檢 · 共 8 題');
  const photo = el('div', null, 'portrait'); photo.setAttribute('role','img'); photo.setAttribute('aria-label','家人坐在一起，聆聽長輩聊天');
  body.before(photo);
  body.append(el('p','回想這幾年的日常生活，和以前的自己相比，有哪些事情變得吃力？您可以自己回答，也可以由熟悉近況的親友協助。','intro'));
  body.append(el('h2','這次為誰觀察？'));
  const actions = el('div',null,'actions');
  actions.append(button('我為自己填寫',()=>begin('本人填寫'),'primary'),button('我為家人或親友填寫',()=>begin('親友協助填寫')));
  body.append(actions,el('p','這份篩檢用來整理觀察，失智症或輕度認知障礙須由醫師評估。個別答案只保留在本頁，離開前可下載摘要。','note'));
}
function question() {
  const q = questions[position];
  const body = panel(q.title, '第 '+(position+1)+' 題 ／ 共 '+questions.length+' 題');
  const progress = el('progress'); progress.max = questions.length; progress.value = position+1; progress.setAttribute('aria-label','題目進度');
  body.prepend(progress);
  const art = button('',()=>{
    const full=dialog.querySelector('img'); full.src='images/'+(position+1)+'.jpg'; full.alt=q.title+'。'+q.example; dialog.showModal();
  },'art');
  const img = el('img'); img.src='images/'+(position+1)+'.jpg'; img.alt=q.title+'的生活情境圖解'; img.width=1280; img.height=720;
  art.append(img,el('span','放大圖卡')); body.append(art,el('p',q.example+'。','intro'));
  if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
    body.append(button('朗讀本題',()=>{window.speechSynthesis.cancel(); const read=new SpeechSynthesisUtterance([q.title,q.example,'請比較與以往的變化',...labels].join('。'));read.lang='zh-TW';read.rate=.9;window.speechSynthesis.speak(read);},'read'));
  }
  const group = el('fieldset'); group.append(el('legend','和以前相比，您觀察到什麼？'));
  const next = button(position === 7 ? '查看觀察摘要' : '下一題',()=>{
    if (answers[position] === null) return;
    if (position === 7) result(); else { position++; question(); }
  },'primary');
  next.disabled = answers[position] === null;
  labels.forEach((value,i)=>{
    const label=el('label',null,'choice'),radio=el('input'),copy=el('span');
    radio.type='radio';radio.name='change';radio.value=String(i);radio.checked=answers[position]===i;
    radio.onchange=()=>{answers[position]=i;next.disabled=false;};
    copy.append(el('strong',value),el('span',hints[i]));label.append(radio,copy);group.append(label);
  });
  const nav=el('div',null,'nav');nav.append(button(position?'上一題':'回到說明',()=>{if(position){position--;question();}else intro();}),next);
  body.append(group,nav);
}
function download(text) {
  const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));
  const a=link('下載',url);a.download='UCell-認知觀察摘要.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function result() {
  const changed=answers.filter(x=>x===0).length,unknown=answers.filter(x=>x===2).length;
  const title=changed>=2?'建議安排專業評估':unknown?'還有情境需要進一步觀察':'繼續留意日常變化';
  const guidance=changed>=2?'觀察到兩項以上改變。可以帶著這份摘要和實際例子，到家醫科、神經內科或記憶門診討論。':
    unknown?'可和熟悉近況的家人再看一次不確定的項目。若變化持續或影響生活，即使分數低於 2 分，仍可向醫師諮詢。':
    '這次記錄的改變少於兩項。如果自己或家人持續感到擔心，或變化影響生活，仍可帶著紀錄諮詢醫師。';
  const body=panel('我的觀察摘要',perspective+' · 已完成 8 題');
  const score=el('div',null,'result');score.append(el('strong','AD8® '+changed+' 分 ／ 8 分'),el('h2',title),el('p',guidance));
  const counts='有明顯改變 '+changed+' 項　沒有改變 '+(8-changed-unknown)+' 項　不知道／不適用 '+unknown+' 項';
  body.append(score,el('p',counts),el('p','只有「有明顯改變」計 1 分。「不知道／不適用」表示這一項的觀察資訊不足。此分數無法確診或排除失智症、輕度認知障礙。','note'));
  const list=el('ol');const detail=el('details');detail.append(el('summary','回看八題答案'));
  const rows=questions.map((q,i)=>q.title+' — '+labels[answers[i]]);
  for(const row of rows)list.append(el('li',row));detail.append(list);body.append(detail);
  body.append(button('下載個人摘要',()=>download(['UCell 健康中心｜失智/輕度認知障礙評估',new Date().toLocaleDateString('zh-TW'),perspective,'AD8® '+changed+' 分 ／ 8 分',counts,title,guidance,...rows,'此為個人觀察紀錄，診斷需由醫師評估。',document.querySelector('footer').textContent].join('\n'))));
  const stamp=el('p');stamp.setAttribute('role','status');
  async function mark() {stamp.textContent='正在記錄完成進度…';const ok=await journey.finish();finished=ok;stamp.textContent=ok?(journey.member?'本週印章已收進健康護照。':'登入後可領取本週印章。'):'暫時無法記錄完成進度。';if(!ok)stamp.append(button('重試領章',mark));}
  if(!finished)mark();
  body.append(stamp,el('h2','邀請親友一起觀察'),el('p','邀請連結只會開啟遊戲，個人答案與分數只在您下載的摘要中。'),journey.sharing(),journey.explore(),link('國民健康署認知篩檢說明',source),el('hr'),button('重新開始',intro),link('返回健康中心','/health/'));
}
const journey = await session('cognition');
main.removeAttribute('aria-busy');if(journey)intro();
