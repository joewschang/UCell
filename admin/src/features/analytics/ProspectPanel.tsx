import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Card,Metric} from '../../components/ui';
import {useAuth} from '../auth/auth';
import {canOpen} from '../auth/permissions';
import './prospects.css';
type Conversion={prospects:number;converted:number;conversionRate:number|null;anonymous:number};
export type ProspectReport=Conversion&{missingAcquisitionEvidence?:number;asOf:string;since:string;days:number;matured30:Omit<Conversion,'anonymous'>;sources:Array<Conversion&{source:string}>;cohorts:Array<Conversion&{month:string}>;current:{anonymous:number;identified:number}};
const percent=(n:number|null)=>n===null?'—':`${(n*100).toFixed(1)}%`;
export function ProspectPanel({windows,missing=0}:{windows?:Record<string,ProspectReport>;missing?:number}){
 const [days,setDays]=useState('30'),report=windows?.[days],{user}=useAuth();
 return <section className="pnasl-acquisition"><div className="pnasl-heading"><div><small>從認識品牌，到成為正式會員</small><h2>P → N 潛客轉正分析</h2><p>分享連結造訪、網路會員註冊，都從潛在客戶開始。此區為全公司統計，不受組織起點篩選影響。</p></div>{canOpen(user?.role,'/marketing')&&<Link to="/marketing">前往分享行銷看板 →</Link>}</div>
 <div className="pnasl-period" aria-label="潛客取得期間">{['7','30','90'].map(value=><button key={value} aria-pressed={value===days} onClick={()=>setDays(value)}>近 {value} 天</button>)}</div>
 {!report?<p role="status">尚無此版本的潛客分析快照，請更新快照後查看；舊版資料不會推測補算。</p>:<><p>觀察近 {report.days} 天首次成為潛客的同一批對象，截至 {new Date(report.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} 的正式會員核准結果。</p>
 <div className="pnasl-metrics"><Metric label="本期新增潛客" value={report.prospects} helper={`尚未識別的瀏覽器 ${report.anonymous} 筆`}/><Metric label="同批已轉正式會員" value={report.converted} helper="核准後即記錄 P → N，即使目前已是 A／S／L"/><Metric label="潛客轉正率" value={percent(report.conversionRate)} helper={`${report.converted} ÷ ${report.prospects}；分母為零時不顯示百分比`}/></div>
 <div className="pnasl-support"><Card title="目前仍在 P 階段"><dl><div><dt>已識別會員</dt><dd>{report.current.identified}</dd></div><div><dt>未識別瀏覽器</dt><dd>{report.current.anonymous}</dd></div></dl><p>目前存量不限於所選取得期間。匿名訪客完成身分連結後，合併為同一會員；多瀏覽器尚未連結時，仍可能重複。</p></Card><Card title="完整 30 日觀察"><strong className="pnasl-rate">{percent(report.matured30.conversionRate)}</strong><p>近 {report.days} 天內剛完成 30 日觀察的 {report.matured30.prospects} 位／筆潛客，其中 {report.matured30.converted} 位於取得後 30 天內轉正。</p><p>這個固定觀察窗，避免新加入的潛客還沒有時間完成申請，就被判定轉換偏低。</p></Card></div>
 <Card title="從哪裡認識我們？"><div className="table-wrap"><table><thead><tr><th>最早可識別來源</th><th>新增潛客</th><th>同批已轉正</th><th>轉正率</th></tr></thead><tbody>{report.sources.map(row=><tr key={row.source}><th scope="row">{row.source==='SHARE'?'會員分享連結':'直接加入網路會員'}</th><td>{row.prospects}</td><td>{row.converted}</td><td>{percent(row.conversionRate)}</td></tr>)}</tbody></table></div><p>以最早可識別的接觸來源歸類；「直接加入」代表尚無更早的分享接觸證據，不代表可證明未看過分享。</p></Card>
 <details className="card"><summary>查看近 12 個取得月份的轉正進展</summary><div className="table-wrap"><table><thead><tr><th>首次成為潛客月份</th><th>同批潛客</th><th>截至快照已轉正</th><th>累積轉正率</th></tr></thead><tbody>{report.cohorts.map(row=><tr key={row.month}><th scope="row">{row.month}</th><td>{row.prospects}</td><td>{row.converted}</td><td>{percent(row.conversionRate)}</td></tr>)}</tbody></table></div>{!report.cohorts.length&&<p>尚無可追蹤的潛客紀錄。</p>}<p>月份採台北時間，各月份的觀察長度不同；此表不等同固定 30 日轉正率。</p></details>
 {report.missingAcquisitionEvidence? <p>另有 {report.missingAcquisitionEvidence} 位正式會員缺少先前潛客接觸證據，保留於正式會員分群，不納入潛客轉正率。</p>:null}
 </>}
 {missing>0&&<p role="alert">有 {missing} 筆正式會員缺少核准時間證據，已排除本版分群與轉正率，避免誤算成潛客。</p>}
 <details className="pnasl-definition"><summary>統計口徑與下一步行動</summary><p>P：有效分享連結載入的未識別訪客，或尚未轉正的網路會員。完成正式會員核准時記錄 P → N；N 的新客觀察期從核准時間起算。</p><p>A／S／L 保留原有付款、重銷認列及 30／90 日規則；轉正前的資格套組付款不會使潛客提前變成活躍正式會員。P 目前不設定自動流失期限。</p><p>轉正率以同一批潛客追蹤，不能用目前 N 人數除以目前 P 人數。匿名識別、跨裝置及清除瀏覽器資料會影響數據，後續身分連結可能合併近期統計；已保存快照保留原始觀測。</p><p>潛客增加但轉正偏少時，先檢查正式會員申請與付款流程；已有轉正時，再觀察首次有效參與及後續留存。</p></details>
 </section>;
}
