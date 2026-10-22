import './persona.css';

/** Fixed UCell virtual representative. Do not substitute a new face per surface. */
export function Persona({compact=false,welcome=false}:{compact?:boolean;welcome?:boolean}) {
 return <div className={compact?'uc-persona uc-persona--compact':'uc-persona'}>
  <img src={`/assets/virtual-agent/${welcome?'welcome':'portrait'}.webp`} alt="穿著宇生制服的短髮 AI 虛擬助理" width="480" height="640" decoding="async"/>
  <div className="uc-persona-caption"><span>AI 虛擬助理</span><strong>UCell 智慧秘書</strong><p>用心聆聽，讓每個問題都有方向。</p></div>
 </div>;
}
export function PersonaAvatar(){return <img className="uc-persona-avatar" src="/assets/virtual-agent/avatar.webp" alt="" width="48" height="48" decoding="async"/>}
export function ServiceWelcome(){return <section className="uc-service-welcome"><Persona compact/><div><h2>您好，需要什麼協助？</h2><p>查詢自己的資料，或找到適合的服務入口。</p><div className="uc-service-links"><a href="/ai-assistant">開啟 AI 助理 →</a><a href="https://ucell.life/faq.html">常見問題</a><a href="https://ucell.life/contact.html">聯絡客服</a></div></div></section>}
