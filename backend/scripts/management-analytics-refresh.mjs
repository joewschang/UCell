// One refresh cycle for an operator-owned scheduler. No recurring job is installed by this script.
import {randomUUID} from 'node:crypto';
const base=new URL(process.env.UCELL_ANALYTICS_API_URL??'http://127.0.0.1:3000/api/v1/');
if(base.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw new Error('TLS_REQUIRED_FOR_REMOTE_ANALYTICS');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const token=process.env.UCELL_ANALYTICS_ADMIN_TOKEN;
if(!token)throw new Error('UCELL_ANALYTICS_ADMIN_TOKEN_REQUIRED');
const roots=(process.env.UCELL_ANALYTICS_ROOT_IDS??'').split(',').map(x=>x.trim()).filter(Boolean);
if(roots.length>20||roots.some(x=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)))throw new Error('MAX_20_VALID_ROOT_UUIDS');
for(const root of roots.length?[...new Set(roots)]:[undefined]){
  const key=randomUUID();let response;
  for(let attempt=0;attempt<2;attempt++){
    try{response=await fetch(new URL('admin/analytics/rebuild',base),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(root?{rootQualificationId:root}:{}),signal:AbortSignal.timeout(70_000)});break;}
    catch(error){if(attempt===1)throw error;}
  }
  if(!response?.ok)throw new Error(`ANALYTICS_REFRESH_HTTP_${response?.status}`);
  const result=await response.json();console.log(JSON.stringify({snapshotId:result.data.snapshotId,asOf:result.data.asOf,replayed:result.data.replayed}));
}
