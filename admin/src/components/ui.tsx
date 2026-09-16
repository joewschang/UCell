import React from 'react';
import {MetricCard} from '@ucell/design-system';

export function PageHeader({title,subtitle,actions}:{title:string;subtitle?:string;actions?:React.ReactNode}){
  return <div className="page-header"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><div>{actions}</div></div>
}
export function Card({title,children,className='' }:{title?:string;children:React.ReactNode;className?:string}){
  return <section className={`card ${className}`}>{title&&<h2>{title}</h2>}{children}</section>
}
export function Metric({label,value,helper}:{label:string;value:string|number;helper?:string}){
  return <MetricCard label={label} value={value} helper={helper}/>
}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'ok'|'warn'|'danger'|'neutral'}){
  return <span className={`badge ${tone}`}>{children}</span>
}
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){
  return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>
}
export function ErrorBox({error}:{error:unknown}){
  if(!error)return null;
  return <div className="callout danger">{error instanceof Error?error.message:String(error)}</div>
}
export function JsonResult({value}:{value:unknown}){return value?<pre className="json">{JSON.stringify(value,null,2)}</pre>:null}
