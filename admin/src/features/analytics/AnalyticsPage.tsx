import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {get,command,qs} from '../../lib/api';
import {Card,Metric,PageHeader,Field,ErrorBox} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {AdminTable} from '../../components/AdminTable';
import {useAuth} from '../auth/auth';
import {NaslOverview,NaslTrend} from './NaslOverview';
import {AnalyticsRetentionPanel} from './AnalyticsRetentionPanel';
import {AnalyticsVolumePanel} from './AnalyticsVolumePanel';
import './analytics.css';

type Counts={N:number;A:number;S:number;L:number};
type Generation={generation:number;qualificationCount:number;systemCount:number;personCount:number;activeCount:number;activeRate:number|null;repurchaseRate:number|null;newRate:number|null;riskRate:number|null;heat:{label:string;reason:string}};
type Summary={status:string;reason?:string;asOf?:string;lagSeconds?:number;policyVersion?:string;total?:number;counts?:Counts;neverActivated?:number;excludedPersonRecords?:number;comparisonAsOf?:string|null;cohorts?:Array<{month:string;total:number;counts:Counts;activeRate:number|null}>;transitions?:{matrix:Record<string,number>;newEntrants:number;removed:number;comparable:number;reactivated:number;becameLost:number;activeRetention:number|null}|null};
type Sonar=Omit<Summary,'total'>&{tree?:string;root?:string;generations?:Generation[];total:Generation;left:Generation|null;right:Generation|null;balance:number|null;heat:{label:string;reason:string};health:{coverage:number;score:number|null;components:Array<{key:string;weight:number;value:number|null}>};sampleWarning:string|null;activeRateDelta:number|null};
export const percent=(value:number|null|undefined)=>value==null?'—':`${(value*100).toFixed(1)}%`;
const names:Record<string,string>={N:'新進',A:'活躍',S:'待關懷',L:'流失',HOT:'健康',WATCH:'觀察',COOLING:'降溫',COLD:'低活躍',CRITICAL:'優先關懷',INSUFFICIENT_SAMPLE:'樣本不足',UNAVAILABLE:'資料不足'};
const componentNames:Record<string,string>={active:'資格活躍',repurchase:'重購參與',growth:'新增成長',risk:'低沉寂風險',balance:'雙軌人數平衡',depth:'各代活躍覆蓋',engagement:'有效互動'};
const endpoint='/admin/analytics';

export function Radar({rows}:{rows:Generation[]}) {
  const point=(i:number,value:number)=>{const angle=i*Math.PI/6-Math.PI/2;return [210+145*value*Math.cos(angle),195+145*value*Math.sin(angle)];};
  return <figure className="analytics-radar"><svg viewBox="0 0 420 410" role="img" aria-label="十二代活躍與重購比例雷達。每軸代表一代，內圈零、外圈百分之百；缺值不繪點。詳細數值見下方表格。">
    {[.25,.5,.75,1].map(v=><polygon key={v} points={Array.from({length:12},(_,i)=>point(i,v).join(',')).join(' ')} fill="none" stroke="#d8e0e8"/>)}
    {rows.map((g,i)=>{const end=point(i,1),label=point(i,1.17);return <g key={g.generation}><line x1="210" y1="195" x2={end[0]} y2={end[1]} stroke="#d8e0e8"/><text x={label[0]} y={label[1]} textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#334155">第{g.generation}代</text>
      {g.activeRate!==null&&<circle cx={point(i,g.activeRate)[0]} cy={point(i,g.activeRate)[1]} r="5" fill="#156b70"/>}
      {g.repurchaseRate!==null&&<rect x={point(i,g.repurchaseRate)[0]-3} y={point(i,g.repurchaseRate)[1]-3} width="6" height="6" fill="#b15c14"/>}</g>;})}
    <text x="215" y="192" fontSize="10" fill="#475569">0</text><text x="215" y="46" fontSize="10" fill="#475569">100%</text>
  </svg><figcaption>● 活躍比例　<span className="analytics-repurchase">■ 重購比例</span> · 無成員的代數不繪點</figcaption></figure>;
}
function Evidence({data}:{data:Pick<Summary,'status'|'asOf'|'policyVersion'>}){return <div className={`analytics-evidence ${data.status==='STALE'?'analytics-stale':''}`} role="status"><strong>{data.status==='STALE'?'資料已過期，請更新快照':data.status==='UNAVAILABLE'?'尚未建立分析快照':'已保存的分析快照'}</strong>{data.asOf&&<span>截至 {new Date(data.asOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台北時間） · {data.policyVersion}</span>}</div>;}

export function AnalyticsPage(){
  const {user}=useAuth(),client=useQueryClient();const canRebuild=user?.role==='SUPER_ADMIN';
  const canDrill=['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT'].includes(user?.role??'');
  const [root,setRoot]=useState(''),[tree,setTree]=useState<'sponsor'|'binary'>('sponsor'),[search,setSearch]=useState(''),[find,setFind]=useState('');
  const [pending,setPending]=useState(false),[error,setError]=useState<unknown>(null),lock=useRef(false);
  const [generation,setGeneration]=useState<number|null>(null);
  const overview=useQuery({queryKey:['analytics','overview'],queryFn:()=>get<{data:Summary}>(`${endpoint}/overview`),refetchInterval:60_000});
  const roots=useQuery({queryKey:['analytics','roots',find],queryFn:()=>get<{data:Array<{id:string;label:string}>}>(`${endpoint}/roots`+qs({q:find}))});
  const sonar=useQuery({queryKey:['analytics','sonar',tree,root],queryFn:()=>get<{data:Sonar}>(`${endpoint}/sonar/${tree}/${root}`),enabled:!!root,refetchInterval:60_000});
  const history=useQuery({queryKey:['analytics','history'],queryFn:()=>get<{data:{rows:Summary[]}}>(`${endpoint}/nasl/history`)});
  const contributors=useQuery({queryKey:['analytics','contributors',root,tree,generation],queryFn:()=>get<{data:{qualificationIds:string[];total:number;truncated:boolean}}>(`${endpoint}/sonar/${tree}/${root}/contributors`+qs({generation})),enabled:canDrill&&!!root&&generation!==null});
  async function rebuild(){if(lock.current)return;lock.current=true;setPending(true);setError(null);
    try{await command(`${endpoint}/rebuild`,root?{rootQualificationId:root}:{});await client.invalidateQueries({queryKey:['analytics']});}
    catch(e){setError(e)}finally{setPending(false);lock.current=false;}}
  const n=overview.error?undefined:overview.data?.data,s=sonar.error?undefined:sonar.data?.data;
  return <div className="analytics-page"><PageHeader title="NASL／十二代組織健康雷達" subtitle="用已發生的經營活動辨識成長與關懷機會。管理指標不影響會員資格、獎金或結算。"/>
    <Card title="分析範圍"><div className="analytics-controls"><form onSubmit={e=>{e.preventDefault();setFind(search);setRoot('');setGeneration(null);}}><Field label="依球號搜尋"><input inputMode="numeric" pattern="[0-9]*" value={search} onChange={e=>setSearch(e.target.value)} placeholder="例如 1001"/></Field><button type="submit">搜尋</button></form>
      <Field label="組織起點（不包含起點本身）"><select value={root} onChange={e=>{setRoot(e.target.value);setGeneration(null);}}><option value="">全公司 NASL；選擇球號可看雷達</option>{roots.data?.data.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select></Field>
      <Field label="組織關係"><select value={tree} onChange={e=>{setTree(e.target.value as 'sponsor'|'binary');setGeneration(null);}}><option value="sponsor">推薦組織</option><option value="binary">雙軌組織</option></select></Field>
      {canRebuild&&<button onClick={rebuild} disabled={pending}>{pending?'建立快照中…':root?'更新 NASL 與此組織雷達':'更新 NASL 快照'}</button>}</div><p className="muted">一次選擇一個組織起點。新快照保留歷史；第一次建立時，趨勢與轉換資料尚不足。</p><QueryFeedback query={roots}/><ErrorBox error={error}/></Card>
    <QueryFeedback query={overview}/>{n&&<Evidence data={n}/>}
    {n?.counts&&<><NaslOverview counts={n.counts} total={n.total??0} asOf={n.asOf} comparisonAsOf={n.comparisonAsOf} matrix={n.transitions?.matrix} newEntrants={n.transitions?.newEntrants}/>
      <p>分析涵蓋 {n.total} 位自然人；排除 {n.excludedPersonRecords} 筆未建立會員身分／系統專用紀錄。待關懷中有 {n.neverActivated} 位尚未啟動。</p>
      <div className="grid two"><Card title="關懷與留存"><p>新進：協助首次有效參與；待關懷：先了解需求與阻礙；流失：確認聯絡意願，再安排適當回訪。</p>{n.transitions?<><div className="metrics mini"><Metric label="再活化" value={n.transitions.reactivated}/><Metric label="轉入流失" value={n.transitions.becameLost}/><Metric label="可追蹤原活躍者仍活躍" value={percent(n.transitions.activeRetention)}/></div><p className="muted">與 {n.comparisonAsOf?new Date(n.comparisonAsOf).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'前次快照'} 比較；這是實際快照間變化，並非固定月份流失率。</p><div className="table-wrap"><AdminTable><caption>NASL 狀態轉換人數</caption><thead><tr><th>由／至</th>{['N','A','S','L'].map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{['N','A','S','L'].map(from=><tr key={from}><th scope="row">{from}</th>{['N','A','S','L'].map(to=><td key={to}>{n.transitions!.matrix[`${from}->${to}`]??0}</td>)}</tr>)}</tbody></AdminTable></div></>:<p>至少需要兩次快照才能顯示狀態轉換。</p>}</Card>
      <Card title="加入月份同期群 · 目前狀態"><div className="table-wrap"><AdminTable><thead><tr><th>月份</th><th>人數</th><th>目前活躍率</th><th>待關懷／流失</th></tr></thead><tbody>{n.cohorts?.map(c=><tr key={c.month}><th scope="row">{c.month}</th><td>{c.total}</td><td>{percent(c.activeRate)}</td><td>{c.counts.S}／{c.counts.L}</td></tr>)}</tbody></AdminTable></div><p className="muted">月份採台北時間的會員紀錄建立日；這是目前組成，尚非歷史留存熱圖。</p></Card></div></>}
    {!root&&<Card title="十二代健康雷達"><p>請先選擇上方球號。推薦樹與雙軌樹分開分析，每一代按經營球計數，NASL 按自然人去重。</p></Card>}
    {!!root&&<QueryFeedback query={sonar}/>}{!!root&&s&&<Evidence data={s}/>}
    {!!root&&s?.generations&&<><div className="grid two"><Card title={`${tree==='sponsor'?'推薦':'雙軌'}組織 · 十二代雷達`}><Radar rows={s.generations}/></Card><Card title="組織健康與資料覆蓋"><h3>{names[s.heat.label]??s.heat.label}</h3><p>{s.sampleWarning?'少於 5 個人員經營球，只呈現數據，不做健康評等。':s.activeRateDelta===null?'尚無約 30 天前的可比快照，暫不判定為「健康」。':'分級採活躍、重購、風險與前期變化。'}</p><p>健康總分：<strong>{s.health.score===null?'資料不足':s.health.score.toFixed(1)}</strong> · 權重資料覆蓋 {s.health.coverage}%</p>
      <dl className="analytics-components">{s.health.components.map(c=><div key={c.key}><dt>{componentNames[c.key]} <small>權重 {c.weight}%</small></dt><dd><span>{percent(c.value)}</span>{c.value!==null&&<meter min="0" max="1" value={c.value} aria-label={componentNames[c.key]}/>}</dd></div>)}</dl><p className="muted">缺值不補零、不重新分配權重。推薦樹不推導雙軌平衡；有效互動尚未接入；業績量與 Carry 請見獨立歷史證據區，不納入本健康總分。</p>{tree==='binary'&&<p>左區 {s.left?.qualificationCount} 球／右區 {s.right?.qualificationCount} 球 · 人數平衡 {percent(s.balance)}（非業績平衡）</p>}</Card></div>
      <Card title="各代明細"><div className="table-wrap"><AdminTable><thead><tr><th>代數</th><th>人員球／系統球</th><th>自然人</th><th>資格活躍率</th><th>重購率</th><th>新增占比</th><th>NASL 風險率</th>{canDrill&&<th>證據</th>}</tr></thead><tbody>{s.generations.map(g=><tr key={g.generation}><th scope="row">第 {g.generation} 代</th><td>{g.qualificationCount}／{g.systemCount}</td><td>{g.personCount}</td><td>{percent(g.activeRate)}</td><td>{percent(g.repurchaseRate)}</td><td>{percent(g.newRate)}</td><td>{percent(g.riskRate)}</td>{canDrill&&<td><button disabled={g.qualificationCount===0} onClick={()=>setGeneration(g.generation)}>檢視球號證據</button></td>}</tr>)}</tbody></AdminTable></div><p className="muted">同一人在同一代只計一次；跨代總人數另行去重，不能把各代人數直接相加。</p></Card>
      {generation!==null&&canDrill&&<Card title={`第 ${generation} 代資格證據`}><QueryFeedback query={contributors}/>{!contributors.error&&contributors.data&&<><p>共 {contributors.data.data.total} 球{contributors.data.data.truncated?'；此處僅顯示前 100 筆':''}</p><ul>{contributors.data.data.qualificationIds.map(id=><li key={id}><code>{id}</code></li>)}</ul></>}</Card>}</>}
    <Card title="每日 NASL 快照趨勢" className="nasl-history-panel"><QueryFeedback query={history}/>{!history.error&&history.data&&<NaslTrend rows={history.data.data.rows}/>}<details><summary>查看每日快照數值</summary><div className="table-wrap"><AdminTable><thead><tr><th>快照時間（台北）</th><th>N</th><th>A</th><th>S</th><th>L</th></tr></thead><tbody>{!history.error&&history.data?.data.rows.map(row=><tr key={row.asOf}><th scope="row">{new Date(row.asOf!).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</th><td>{row.counts?.N}</td><td>{row.counts?.A}</td><td>{row.counts?.S}</td><td>{row.counts?.L}</td></tr>)}</tbody></AdminTable></div></details><p className="muted">最近 90 天每日最後一份快照；未建立的日期保留空缺，不回填推測值。</p></Card>
    <AnalyticsVolumePanel root={root} tree={tree}/>
    <AnalyticsRetentionPanel/>
    <Card title="管理定義"><p><strong>N：</strong>建立紀錄 30 天內、尚無有效活動。<strong>A：</strong>最近 30 天有付款或重購認列。<strong>S：</strong>超過 30 天、未超過 90 天沒有有效活動。<strong>L：</strong>超過 90 天，或關係已關閉。</p><p>登入、瀏覽與已讀不會單獨形成活躍；退款不抹去曾發生的付款互動。這裡的 NASL 活躍與制度資格 Active 是兩個不同指標。</p></Card>
  </div>;
}
