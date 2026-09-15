import {useState} from 'react';
import {command,get} from '../lib/api';
import {Card,ErrorBox,Field,JsonResult,PageHeader} from './ui';

export function ApiWorkbench({title,subtitle,actions}:{title:string;subtitle:string;actions:Array<{label:string;method:'GET'|'POST';path:(id:string)=>string;defaultBody?:unknown}>}){
  const [id,setId]=useState('');
  const [body,setBody]=useState('{}');
  const [result,setResult]=useState<unknown>(null);
  const [error,setError]=useState<unknown>(null);
  async function run(a:typeof actions[number]){
    setError(null);setResult(null);
    try{
      const p=a.path(id.trim());
      const v=a.method==='GET'?await get(p):await command(p,body.trim()?JSON.parse(body):undefined);
      setResult(v);
    }catch(e){setError(e)}
  }
  return <>
    <PageHeader title={title} subtitle={subtitle}/>
    <div className="grid two">
      <Card title="操作">
        <div className="form">
          <Field label="主要 ID / UUID"><input value={id} onChange={e=>setId(e.target.value)} placeholder="貼上 Qualification / Order / Application ID"/></Field>
          <Field label="JSON Request Body"><textarea rows={12} value={body} onChange={e=>setBody(e.target.value)}/></Field>
          <div className="button-row">{actions.map(a=><button key={a.label} onClick={()=>run(a)}>{a.label}</button>)}</div>
          <ErrorBox error={error}/>
        </div>
      </Card>
      <Card title="API Result"><JsonResult value={result}/></Card>
    </div>
  </>
}
