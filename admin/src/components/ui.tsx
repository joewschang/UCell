import {uiText} from "../../../shared/design-system/i18n";
import React from 'react';
import {MetricCard,PageHeader as DesignPageHeader,StatusBadge,ErrorState} from '@ucell/design-system';

export function PageHeader({title,subtitle,actions}:{title:string;subtitle?:string;actions?:React.ReactNode}){
  return <DesignPageHeader title={title} subtitle={subtitle} actions={actions}/>;
}
export function Card({title,children,className='' }:{title?:string;children:React.ReactNode;className?:string}){
  return <section className={`card ${className}`}>{title&&<h2>{uiText(title)}</h2>}{children}</section>
}
export function Metric({label,value,helper}:{label:string;value:string|number;helper?:string}){
  return <MetricCard label={label} value={value} helper={helper}/>
}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'ok'|'warn'|'danger'|'neutral'}){
  return <StatusBadge status={typeof children==='string'?children:({ok:'SUCCESS',warn:'PENDING',danger:'FAILED',neutral:'DRAFT'}[tone])} label={children}/>;
}
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){
  return <label className="field"><span>{uiText(label)}</span>{children}{hint&&<small>{uiText(hint)}</small>}</label>
}
export function ErrorBox({error}:{error:unknown}){
  if(!error)return null;
  return <ErrorState message={error instanceof Error?error.message:String(error)}/>;
}
export function JsonResult({value}:{value:unknown}){return value?<pre className="json">{JSON.stringify(value,null,2)}</pre>:null}
