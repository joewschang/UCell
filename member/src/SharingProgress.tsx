import {Link} from 'react-router-dom';
import {memberApi} from './memberApi';
import {useResource} from './useResource';
import './sharing-progress.css';
type Progress={asOf:string;rows:{links:number;visitors:number;registrations:number;lastEncouragedAt:string|null;lastMessage:string|null}[]};
export default function SharingProgress({qualificationId,refreshKey=0}:{qualificationId:string;refreshKey?:number}){
 const state=useResource('sharing-progress:'+qualificationId+':'+refreshKey,signal=>memberApi<Progress>('/member/sharing-progress?qualificationId='+encodeURIComponent(qualificationId),{signal}));
 const row=state.data?.rows[0],steps=[['建立專屬連結',!!row?.links],['迎來有效造訪',!!row?.visitors],['陪伴新會員加入',!!row?.registrations]] as const;
 return <section className="card uc-sharing-progress"><small>每一小步，都值得肯定</small><h2>我的分享進展</h2>{state.error?<><p role="alert">分享進展暫時無法讀取，仍可使用下方分享功能。</p><button onClick={state.retry}>重新載入進展</button></>:!state.data?<p role="status">正在讀取分享進展…</p>:<><p>近 30 天建立的連結與累積成果；每個階段都是可以慢慢完成的小目標。</p><ol>{steps.map(([label,done],i)=><li key={label} className={done?'achieved':''}><span aria-hidden="true">{done?'✓':i+1}</span><div><strong>{label}</strong><small>{done?'本期已達成':'等待您的下一步'}</small></div></li>)}</ol><p>{row?.registrations?'謝謝您的介紹！接下來，陪伴新朋友熟悉會員服務。':row?.visitors?'已經有朋友透過分享造訪了。可以依對方需要，回答問題與提供協助。':row?.links?'專屬連結準備好了，搭配您的真實心得，分享給有興趣的朋友。':'挑一份您熟悉的內容，從第一個專屬連結開始。'}</p><div className="uc-content-actions"><Link to="/shop">挑選適合的商品 →</Link><Link to="/notifications">查看站內鼓勵與訊息 →</Link></div>{row?.lastMessage&&<aside><strong>來自營運團隊的鼓勵</strong><p>{row.lastMessage}</p><small>{new Date(row.lastEncouragedAt!).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})} · 開啟通知中心可標記已讀</small></aside>}<small>進展依目前球位統計；造訪不等於成交，里程碑不影響資格與獎金。</small></>}</section>;
}
