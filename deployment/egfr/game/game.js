import {apiFor} from '../context-ui.js';
const $=id=>document.getElementById(id);
const screens=['entry','report','challenge','done'];
let example=false;
function screen(name,focus=true){
  window.speechSynthesis?.cancel();
  for(const id of screens) $(id).hidden=id!==name;
  document.querySelectorAll('.steps li').forEach((node,i)=>{node.removeAttribute('aria-current');if(i===Math.min(2,screens.indexOf(name)))node.setAttribute('aria-current','step')});
  if(focus)$(name).querySelector('h2').focus();
}
function toggle(id,cls,on){document.documentElement.classList.toggle(cls,on);$(id).setAttribute('aria-pressed',String(on))}
let preference; try { preference=localStorage.getItem('ucell.ui-theme-preference.v1'); } catch {}
toggle('theme','dark',preference==='DARK'||(preference!=='LIGHT'&&matchMedia('(prefers-color-scheme: dark)').matches));
$('theme').onclick=()=>toggle('theme','dark',!document.documentElement.classList.contains('dark'));
$('large').onclick=()=>toggle('large','large',!document.documentElement.classList.contains('large'));
function view(id,title){$('caption').textContent=title;$('enlarged').src=$(id).src;$('enlarged').alt=title;$('viewer').showModal()}
$('how').onclick=()=>view('kidney','腎絲球過濾血液，腎小管回收水分與養分');$('symptoms').onclick=()=>view('signs','泡、水、高、貧、倦：腎臟健康自我觀察');$('close').onclick=()=>$('viewer').close();
function estimate(age,sex,mg){const female=sex==='female',r=mg/(female ? 0.7 : 0.9);return 142*Math.min(r,1)**(female?-.241:-.302)*Math.max(r,1)**-1.2*.9938**age*(female?1.012:1)}
const bands=[
 [90,'G1 · 90 以上','過濾率在此區間仍可能有尿蛋白等異常。可和上次報告及尿液檢查一起看。'],
 [60,'G2 · 60 至未滿 90','這個區間本身不足以判定慢性腎臟病。請對照過去數值與尿液檢查。'],
 [45,'G3a · 45 至未滿 60','可聯絡開單醫師，比對過往數值，討論何時複查與是否需要驗尿白蛋白。'],
 [30,'G3b · 30 至未滿 45','請儘快與醫師檢視這次結果、近期身體狀況及用藥，討論後續評估。'],
 [15,'G4 · 15 至未滿 30','請儘快聯絡醫療團隊，討論腎臟專科評估。如果是新發現或明顯下降，請告知醫師。'],
 [0,'G5 · 未滿 15','若首次發現這麼低的數值、或比以往明顯下降，請今天聯絡醫療團隊。若伴隨明顯呼吸困難或意識改變，請立即就醫。']
];
function clearQuiz(){$('feedback').textContent='';$('claim').hidden=true;for(const b of $('quiz').children)b.setAttribute('aria-pressed','false')}
function calculate(){
 const age=$('age').valueAsNumber,sex=document.querySelector('input[name=sex]:checked')?.value,cr=$('cr').valueAsNumber;
 const mg=$('unit').value==='mg/dL'?cr:cr/88.4;
 if(!Number.isInteger(age)||age<18||age>120||!sex||!Number.isFinite(mg)||mg<0.05||mg>50)return false;
 const val=estimate(age,sex,mg);if(!Number.isFinite(val)||val<=0)return false;
 const [,label,advice]=bands.find(b=>val>=b[0]);
 const rounded=Number(val.toFixed(1)), adjacent=bands.find(b=>rounded>=b[0]);
 $('score').textContent=val<.1?'＜0.1':adjacent[1]!==label?'＜'+rounded:val.toFixed(1);
 $('band').textContent='eGFR 區間 '+label;$('advice').textContent=advice;
 $('resultHeading').textContent=example?'範例換算結果':'本次換算結果';
 $('inputs').textContent=(example?'教學範例 · ':'')+age+' 歲 · '+(sex==='female'?'女性':'男性')+' · 肌酸酐 '+cr+' '+$('unit').value;
 $('edit').textContent=example?'改用我的報告':'修改輸入';clearQuiz();screen('report');return true;
}
$('calc').onsubmit=e=>{e.preventDefault();if(!calculate()){$('notice').textContent='請核對血清肌酸酐的數值與單位。本工具可輸入 0.05–50 mg/dL（4.42–4420 µmol/L），超出範圍請交由醫療人員解讀。';$('cr').focus()}};
$('calc').oninput=()=>{example=false;$('notice').textContent=''};
$('unit').onchange=()=>{if($('cr').value){$('cr').value='';$('notice').textContent='單位已切換，請依報告重新輸入肌酸酐。';$('cr').focus()}};
$('demo').onclick=()=>{$('age').value=65;document.querySelector('input[value=male]').checked=true;$('cr').value='1.00';$('unit').value='mg/dL';example=true;calculate()};
$('edit').onclick=()=>{if(example){$('calc').reset();example=false}$('notice').textContent='';screen('entry')};$('learn').onclick=()=>screen('challenge');$('resultAgain').onclick=$('back').onclick=()=>screen('report');
if(window.speechSynthesis&&window.SpeechSynthesisUtterance){$('read').hidden=false;$('read').onclick=()=>{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance([$('resultHeading').textContent,'估計腎絲球過濾率',$('score').textContent,$('band').textContent,$('advice').textContent].join('。'));u.lang='zh-TW';u.rate=.85;speechSynthesis.speak(u)}}
Array.from($('quiz').children).forEach((b,i)=>b.onclick=()=>{clearQuiz();b.setAttribute('aria-pressed','true');$('feedback').textContent=['這些情形可能有不同原因。請再想想，如何讓醫師了解你的變化？','答對了。記下出現的時間與頻率，醫師可配合血液及尿液檢查進一步評估。','腎臟病早期可能沒有症狀。再選一次，想想如何運用檢驗報告。'][i];$('claim').hidden=i!==1});
$('claim').onclick=()=>screen('done');$('reset').onclick=()=>{$('calc').reset();example=false;$('notice').textContent='';clearQuiz();screen('entry')};
$('card').onclick=()=>{const c=document.createElement('canvas');c.width=960;c.height=540;const ctx=c.getContext('2d');ctx.fillStyle='#153f41';ctx.fillRect(0,0,960,540);ctx.fillStyle='#e8c98e';ctx.font='bold 38px sans-serif';ctx.fillText('UCell 健康中心',60,104);ctx.fillRect(60,148,845,3);ctx.fillStyle='#fffdf5';ctx.font='bold 61px sans-serif';ctx.fillText('我完成了腎臟觀察挑戰',60,286);ctx.font='32px sans-serif';ctx.fillText('讀懂 eGFR・記住五字口訣',60,393);const a=document.createElement('a');a.download='UCell-腎臟觀察完成卡.png';a.href=c.toDataURL();a.click()};
async function openGame() {
  const loading = $('loading');
  const message = loading.querySelector('[role="status"]');
  $('retry').hidden = true;
  message.textContent = '正在開啟腎絲球過濾率計算小程式…';
  try {
    const config = await apiFor('public')('');
    if (config.open !== true) {
      message.textContent = '健康中心的小遊戲目前暫停開放。';
      return;
    }
    screen('entry',false);
    loading.hidden = true;
    $('game').hidden = false;
  } catch (error) {
    message.textContent = error.message;
    $('retry').hidden = false;
  }
}
$('retry').onclick = openGame;
openGame();
