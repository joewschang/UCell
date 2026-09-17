import {useMemo,useState} from 'react';
import {Badge,Card,Field,Metric,PageHeader} from '../../components/ui';
import {scenarios,UatStatus} from './uat-scenarios';

interface Result{status:UatStatus;evidence:string;tester:string;executedAt:string}
type Results=Record<string,Result>;
const key='ucell_uat_r6_results';

function load():Results{
  try{return JSON.parse(localStorage.getItem(key)??'{}')}catch{return{}}
}
export function UatPage(){
  const [results,setResults]=useState<Results>(load);
  const [priority,setPriority]=useState('ALL');const [area,setArea]=useState('ALL');
  const areas=[...new Set(scenarios.map(x=>x.area))];
  const filtered=scenarios.filter(x=>(priority==='ALL'||x.priority===priority)&&(area==='ALL'||x.area===area));
  const counts=useMemo(()=>{
    const vals=scenarios.map(x=>results[x.id]?.status??'NOT_RUN');
    return {
      pass:vals.filter(x=>x==='PASS').length,
      fail:vals.filter(x=>x==='FAIL').length,
      blocked:vals.filter(x=>x==='BLOCKED').length,
      notRun:vals.filter(x=>x==='NOT_RUN').length,
    };
  },[results]);

  function update(id:string,patch:Partial<Result>){
    setResults(prev=>{
      const next={...prev,[id]:{
        status:prev[id]?.status??'NOT_RUN',
        evidence:prev[id]?.evidence??'',
        tester:prev[id]?.tester??'',
        executedAt:prev[id]?.executedAt??'',
        ...patch
      }};
      localStorage.setItem(key,JSON.stringify(next));return next;
    });
  }
  function exportJson(){
    const data={
      release:'R6',
      evidenceClassification:'LOCAL_ASSISTIVE_ONLY',
      formalSignOff:false,
      exportedAt:new Date().toISOString(),
      results
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`ucell_uat_r6_local_assistive_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  }

  return <><PageHeader title="UAT 執行輔助工具" subtitle="協助逐項記錄 R6 測試；本頁不建立正式 UAT 證據或簽核。" actions={<button onClick={exportJson}>匯出本機輔助 JSON（非簽核）</button>}/>
    <Card className="alert-panel"><div role="alert"><Badge tone="warn">LOCAL_ASSISTIVE_ONLY</Badge><h2>僅限瀏覽器本機執行輔助</h2><p>本頁資料保存在目前瀏覽器的 localStorage，可能被修改或清除，不是受治理的正式證據。</p><p><strong>畫面狀態、統計與匯出 JSON 均不得作為 UAT 簽核、Release Gate PASS 或 Production Promotion 依據。</strong></p><p className="muted">正式 UAT 必須使用核准的 evidence store、身分與時間證據，以及完成簽核的 UAT_EXECUTION_R6.csv。</p></div></Card>
    <div className="metrics"><Metric label="PASS" value={counts.pass}/><Metric label="FAIL" value={counts.fail}/><Metric label="BLOCKED" value={counts.blocked}/><Metric label="NOT RUN" value={counts.notRun}/></div>
    <Card title="篩選"><div className="toolbar"><select value={priority} onChange={e=>setPriority(e.target.value)}><option>ALL</option><option>P0</option><option>P1</option></select><select value={area} onChange={e=>setArea(e.target.value)}><option>ALL</option>{areas.map(x=><option key={x}>{x}</option>)}</select></div></Card>
    <Card title={`Scenarios (${filtered.length})`}><div className="uat-list">{filtered.map(x=>{
      const r=results[x.id]??{status:'NOT_RUN',evidence:'',tester:'',executedAt:''};
      return <section className="uat-case" key={x.id}>
        <div className="uat-head"><div><strong>{x.id} · {x.area}</strong><p>{x.scenario}</p><small>Expected: {x.expected}</small></div><Badge tone={x.priority==='P0'?'danger':'warn'}>{x.priority}</Badge></div>
        <div className="filter-grid">
          <Field label="Status"><select value={r.status} onChange={e=>update(x.id,{status:e.target.value as UatStatus,executedAt:new Date().toISOString()})}><option>NOT_RUN</option><option>PASS</option><option>FAIL</option><option>BLOCKED</option></select></Field>
          <Field label="Tester"><input value={r.tester} onChange={e=>update(x.id,{tester:e.target.value})}/></Field>
          <Field label="Evidence / Ticket / Correlation ID"><input value={r.evidence} onChange={e=>update(x.id,{evidence:e.target.value})}/></Field>
        </div>
      </section>
    })}</div></Card>
  </>
}
