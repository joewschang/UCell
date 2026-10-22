import {Assistant} from '../../shared/ai-assistant/Assistant';
import {api as rawApi} from './api';
const api=async<T,>(path:string,init?:RequestInit):Promise<T>=>(await rawApi<{data:T}>(path,init)).data;
import type {Qualification} from './api';
export default function AiAssistant({q}:{q?:Qualification}){return <Assistant key={q?.id??'self'} audience="member" qualificationId={q?.id} qualificationLabel={q?`${q.code} · ${q.rank}`:undefined} request={api}/>}
