import { useState } from 'react';
import { Link } from 'react-router-dom';
import './health-center.css';

type Mission = { id: string; title: string; topic: string; prompt: string; choices: string[]; answer: number; lesson: string };
const missions: Mission[] = [
  { id: 'muscle', title: '腿力觀察員', topic: '肌少症', prompt: '想觀察最近的腿力，哪件日常小事值得記下？', choices: ['從熟悉的椅子起身比以前費力', '今天穿哪一種顏色'], answer: 0, lesson: '記下哪些動作變得吃力，以及從何時開始。若站不穩，可跳過動作，帶著觀察紀錄諮詢專業人員。' },
  { id: 'glucose', title: '血糖線索簿', topic: '糖尿病', prompt: '整理兩次血糖報告時，哪個線索能幫助醫療人員判讀？', choices: ['只圈出比較低的數字', '標明日期、單位及空腹或飯後'], answer: 1, lesson: '保留量測情境和原始報告。若想了解自己是否有糖尿病，可請醫療人員安排適當檢查。' },
  { id: 'pressure', title: '血壓節奏家', topic: '居家血壓', prompt: '居家血壓的「722」紀錄法，哪一張任務卡正確？', choices: ['連續七天、早晚兩個時段、每次量兩遍', '一天量七次，挑兩次最低值'], answer: 0, lesson: '把兩次讀數和量測時間都記下來，回診時一起帶給醫療人員。' },
  { id: 'egfr', title: '腎功能換算室', topic: '成人 eGFR', prompt: '換算前，應先核對檢驗單上的哪個欄位？', choices: ['尿糖的顏色', '血清肌酸酐及其單位'], answer: 1, lesson: '下方可試算成人 2021 CKD-EPI 肌酸酐公式。估算值需配合其他檢驗與臨床情況解讀。' },
  { id: 'bone', title: '骨骼線索偵探', topic: '骨質疏鬆', prompt: '家人發現自己比以前矮了，哪個做法能留下有用的線索？', choices: ['記下實測身高、日期與過去紀錄', '用手摸脊椎猜骨密度'], answer: 0, lesson: '可在看診時提出身高變化或曾經骨折的情況，討論是否需要骨密度檢查。' },
  { id: 'memory', title: '出門記憶包', topic: '認知健康・MCI', prompt: '記住這份出門清單，準備好後翻面找出正確的一組。', choices: ['鑰匙、手帕、公車卡', '鑰匙、眼鏡、公車卡', '水壺、眼鏡、公車卡'], answer: 1, lesson: '這是記憶遊戲。若本人或家人觀察到影響生活的持續變化，可記下具體例子與醫師討論。' },
  { id: 'ckd', title: '護腎報告拼圖', topic: '慢性腎臟病', prompt: '追蹤腎臟健康時，哪兩項報告值得放在一起看？', choices: ['視力和身高', 'eGFR 與尿白蛋白／肌酸酐比（UACR）'], answer: 1, lesson: '把不同日期的血液和尿液報告依序整理，方便與醫療人員討論變化。' },
  { id: 'lung', title: '呼吸生活地圖', topic: '慢性阻塞性肺病', prompt: '最近走同一段路更容易喘，哪一筆紀錄有助於看診？', choices: ['走了多遠開始喘、何時開始改變', '忍住呼吸的最長秒數'], answer: 0, lesson: '可以記錄呼吸不適的情境、咳嗽與痰的變化，並與醫師討論是否需要肺功能檢查。' },
];

function KidneyCalculator() {
  const [age, setAge] = useState('');
  const [cr, setCr] = useState('');
  const [sex, setSex] = useState('');
  const [unit, setUnit] = useState('mg/dL');
  const creatinine = Number(cr) / (unit === 'mg/dL' ? 1 : 88.4);
  const female = sex === 'f';
  const ratio = creatinine / (female ? 0.7 : 0.9);
  const valid = sex && Number.isInteger(Number(age)) && Number(age) >= 18 && creatinine > 0 && Number.isFinite(creatinine);
  const estimate = valid ? 142 * Math.min(ratio, 1) ** (female ? -0.241 : -0.302) * Math.max(ratio, 1) ** -1.2 * 0.9938 ** Number(age) * (female ? 1.012 : 1) : null;
  return <fieldset><legend>成人 eGFR 試算</legend>
    <label>足歲（18 歲以上）<input type="number" min="18" value={age} onChange={e=>setAge(e.target.value)}/></label>
    <label>公式使用的性別<select value={sex} onChange={e=>setSex(e.target.value)}><option value="">請選擇</option><option value="f">女</option><option value="m">男</option></select></label>
    <label>血清肌酸酐<input type="number" step="any" min="0" value={cr} onChange={e=>setCr(e.target.value)}/></label>
    <label>檢驗單單位<select value={unit} onChange={e=>setUnit(e.target.value)}><option>mg/dL</option><option>µmol/L</option></select></label>
    <p aria-live="polite">{estimate === null ? '填妥成人年齡、性別與正值肌酸酐後顯示估算值。' : `估算 eGFR 約 ${Math.round(estimate)} mL/min/1.73 m²`}</p>
    <a href="https://www.niddk.nih.gov/research-funding/research-programs/kidney-clinical-research-epidemiology/laboratory/glomerular-filtration-rate-equations/adults">查看成人公式與適用說明</a>
  </fieldset>;
}

export function HealthCenter({ memberNo }: { memberNo?: string | null }) {
  const storageKey = memberNo ? 'ucell.health.badges.v1.' + memberNo : null;
  const [earned, setEarned] = useState<string[]>(()=>{
    try {
      const saved = storageKey && JSON.parse(localStorage.getItem(storageKey) || '[]');
      return missions.filter(m=>Array.isArray(saved) && saved.includes(m.id)).map(m=>m.id);
    } catch { return []; }
  });
  const [mission, setMission] = useState<Mission | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  function open(next: Mission | null) {
    setMission(next); setChoice(null); setFlipped(false);
  }
  function choose(index: number) {
    if (!mission) return;
    setChoice(index);
    if (index !== mission.answer || earned.includes(mission.id)) return;
    const next = [...earned, mission.id];
    setEarned(next);
    try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session progress still works. */ }
  }
  const invite = '一起來 UCell 健康中心玩生活小任務！ ' + window.location.origin + '/explore/health';
  return <article className="uc-health"><Link to="/explore">← 返回探索</Link><h1>健康中心</h1><a className="card" href="/health/">本週任務 · 居家腿力與骨骼自我觀察 →</a>
    {mission ? <section className="card" key={mission.id}>
      <small>{mission.topic}</small><h2>{mission.title}</h2><p>{mission.prompt}</p>
      {mission.id === 'memory' && !flipped ? <><p className="health-memory">鑰匙　眼鏡　公車卡</p><button onClick={()=>setFlipped(true)}>記好了，翻面</button></> :
      <div className="health-choices">{mission.choices.map((option,i)=><button key={option} disabled={choice===mission.answer} onClick={()=>choose(i)}>{option}</button>)}</div>}
      <div aria-live="polite">{choice !== null && (choice === mission.answer ? <><h3>已取得「{mission.title}」徽章</h3><p>{mission.lesson}</p></> : <p>再想一下，可以重新選擇。</p>)}</div>
      {mission.id==='egfr' && <KidneyCalculator/>}
      <button onClick={()=>open(null)}>回任務地圖</button>
    </section> : <><section className="card"><h2>我的健康護照</h2><p>挑一個生活任務開始。每探索一個主題，就能收集一枚徽章。</p><progress max={missions.length} value={earned.length}/><p>{earned.length}／{missions.length} 枚任務徽章</p></section>
      <div className="health-map">{missions.map(m=><button key={m.id} onClick={()=>open(m)}><small>{m.topic}</small><strong>{m.title}</strong><span>{earned.includes(m.id)?'✓ 已收集・再玩一次':'開始挑戰 →'}</span></button>)}</div>
      <a className="text-link" href={'https://line.me/R/msg/text/?'+encodeURIComponent(invite)}>透過 LINE 邀朋友來挑戰</a></>}
    <p><small>徽章代表學習進度。健康疑問可帶回診討論。</small></p>
  </article>;
}
