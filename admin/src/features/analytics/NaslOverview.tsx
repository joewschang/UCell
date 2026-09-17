import type {CSSProperties} from 'react';

export type NaslCounts=Record<'N'|'A'|'S'|'L',number>;
export type NaslSnapshot={asOf?:string;policyVersion?:string;counts?:NaslCounts};
const states=['N','A','S','L'] as const;
const labels={N:'新進會員',A:'活躍會員',S:'待關懷會員',L:'流失會員'};
const colors={N:'#66b8ff',A:'#85d6a1',S:'#f0be65',L:'#f28c95'};
const number=new Intl.NumberFormat('zh-TW');
const day=(date:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
const instantLabel=(date?:string)=>date?new Date(date).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'—';
const dateLabel=(date?:string)=>date?new Date(date).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
type Props={counts:NaslCounts;total:number;asOf?:string;comparisonAsOf?:string|null;matrix?:Record<string,number>;newEntrants?:number};

export function NaslOverview({counts,total,asOf,comparisonAsOf,matrix,newEntrants}:Props){
 const sum=states.reduce((n,s)=>n+counts[s],0);
 let offset=0;
 const stops=states.map(s=>{const start=offset;offset+=sum?counts[s]/sum*100:0;return `${colors[s]} ${start}% ${offset}%`;});
 const flows=[['N','A'],['A','S'],['S','A'],['S','L'],['L','A']] as const;
 return <section className="nasl-overview" aria-label="會員生命週期總覽">
  <div className="nasl-heading"><div><span className="nasl-eyebrow">UCELL · MEMBER INTELLIGENCE</span><h2>看見會員變化，找到關懷起點</h2><p>自然人生命週期 · 截至 {dateLabel(asOf)}</p></div><span className="nasl-scope">全公司 · 按人去重</span></div>
  <div className="nasl-kpis">{states.map(s=><article key={s} className="nasl-kpi" style={{'--state-color':colors[s]} as CSSProperties}><span className="nasl-state">{s}</span><h3>{labels[s]}</h3><strong>{number.format(counts[s])}</strong><p>{total>0?`${(counts[s]/total*100).toFixed(1)}%`:'—'} <span>占分析會員</span></p></article>)}</div>
  <div className="nasl-main-grid">
   <section className="nasl-panel"><div className="nasl-panel-title"><h3>生命週期流向</h3><span>單位：人</span></div>
    <div className="nasl-state-path" aria-label="N 新進、A 活躍、S 待關懷、L 流失">{states.map(s=><div key={s} style={{'--state-color':colors[s]} as CSSProperties}><b>{s}</b><span>{labels[s]}</span></div>)}</div>
    {matrix&&comparisonAsOf?<><p className="nasl-caption">{instantLabel(comparisonAsOf)} → {instantLabel(asOf)} · 兩次快照間變化</p><dl className="nasl-flows">{flows.map(([from,to])=><div key={`${from}->${to}`}><dt><span style={{color:colors[from]}}>{from}</span><span aria-hidden="true"> → </span><span style={{color:colors[to]}}>{to}</span><small>{labels[from]}轉為{labels[to]}</small></dt><dd>{number.format(matrix[`${from}->${to}`]??0)}</dd></div>)}</dl><p className="nasl-caption">新納入分析 {number.format(newEntrants??0)} 人。此處顯示主要流向；完整轉換矩陣見下方。</p></>:<p className="nasl-empty">累積兩次可比較快照後，顯示會員流向。現有人數不代表轉換人數。</p>}
   </section>
   <section className="nasl-panel"><div className="nasl-panel-title"><h3>會員組成</h3><span>目前快照</span></div><div className="nasl-donut" role="img" aria-label={`會員組成，共 ${sum} 人；${states.map(s=>`${labels[s]} ${counts[s]} 人`).join('、')}`} style={{background:sum?`conic-gradient(${stops.join(',')})`:'#304256'}}><div><span>分析會員</span><strong>{number.format(sum)}</strong><small>人</small></div></div><ul className="nasl-legend">{states.map(s=><li key={s}><span><i style={{background:colors[s]}}/>{s} {labels[s]}</span><strong>{number.format(counts[s])}</strong></li>)}</ul></section>
  </div>
 </section>;
}

// Break lines at missing calendar days or policy changes; retain true zero counts.
export function trendSegments(rows:NaslSnapshot[],state:keyof NaslCounts){
 const sorted=rows.filter(r=>r.asOf&&Number.isFinite(Date.parse(r.asOf))).slice().sort((a,b)=>Date.parse(a.asOf!)-Date.parse(b.asOf!));
 const segments:Array<Array<{at:number;value:number;label:string}>>=[];
 let previous:NaslSnapshot|undefined;
 for(const row of sorted){
  if(!row.counts||!Number.isFinite(row.counts[state])){previous=undefined;continue;}
  const at=Date.parse(`${day(row.asOf!)}T00:00:00Z`);
  const previousAt=previous?Date.parse(`${day(previous.asOf!)}T00:00:00Z`):0;
  if(!previous||at-previousAt!==86_400_000||row.policyVersion!==previous.policyVersion)segments.push([]);
  segments[segments.length-1].push({at,value:row.counts[state],label:dateLabel(row.asOf)});previous=row;
 }
 return segments;
}

export function NaslTrend({rows}:{rows:NaslSnapshot[]}){
 const series=states.map(s=>({state:s,segments:trendSegments(rows,s)}));
 const points=series.flatMap(s=>s.segments.flat());
 if(!points.length)return <p className="nasl-empty">尚無可繪製的每日快照。建立快照後，這裡會顯示實際歷史。</p>;
 const min=Math.min(...points.map(p=>p.at)),max=Math.max(...points.map(p=>p.at));
 const ceiling=Math.max(2,Math.ceil(Math.max(...points.map(p=>p.value))/2)*2);
 const x=(at:number)=>max===min?400:60+(at-min)/(max-min)*680;
 const y=(value:number)=>205-value/ceiling*160;
 return <figure className="nasl-trend"><svg viewBox="0 0 800 255" role="img" aria-label="每日 NASL 人數趨勢；缺日期或政策變更處不連線，詳細數值見下方快照表"><text x="60" y="20">單位：人</text>{(ceiling>1?[0,.5,1]:[0,1]).map(r=><g key={r}><line x1="60" x2="740" y1={y(ceiling*r)} y2={y(ceiling*r)} className="nasl-grid-line"/><text x="48" y={y(ceiling*r)+4} textAnchor="end">{number.format(Math.round(ceiling*r))}</text></g>)}{series.map(({state,segments})=><g key={state} data-series={state}>{segments.map((segment,i)=><g key={i}>{segment.length>1&&<polyline points={segment.map(p=>`${x(p.at)},${y(p.value)}`).join(' ')} fill="none" stroke={colors[state]} strokeWidth="2.5"/>}{segment.map(p=><circle key={p.at} cx={x(p.at)} cy={y(p.value)} r="3" fill={colors[state]}><title>{`${p.label} · ${labels[state]} ${p.value} 人`}</title></circle>)}</g>)}</g>)}<text x="60" y="240">{new Date(min).toLocaleDateString('zh-TW',{timeZone:'UTC'})}</text><text x="740" y="240" textAnchor="end">{new Date(max).toLocaleDateString('zh-TW',{timeZone:'UTC'})}</text></svg><figcaption>{states.map(s=><span key={s}><i style={{background:colors[s]}}/>{s} {labels[s]}</span>)}</figcaption><p className="nasl-caption">依每日實際快照繪製；缺日期與政策版本變更處斷線，不補零。</p></figure>;
}
