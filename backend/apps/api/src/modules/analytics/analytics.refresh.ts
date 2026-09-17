import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { ANALYTICS_POLICY } from './analytics.policy';
import { AnalyticsService, requireUuid } from './analytics.service';

export function refreshConfiguration(get:(key:string)=>string|undefined){
  const enabled=get('UCELL_ANALYTICS_REFRESH_ENABLED')==='true';
  const seconds=Number(get('UCELL_ANALYTICS_REFRESH_SECONDS')??300);
  if(!Number.isInteger(seconds)||seconds<60||seconds>600)throw new Error('ANALYTICS_REFRESH_SECONDS_60_TO_600');
  const roots=[...new Set((get('UCELL_ANALYTICS_REFRESH_ROOTS')??'').split(',').map(x=>x.trim()).filter(Boolean))];
  if(roots.length>5)throw new Error('ANALYTICS_REFRESH_MAX_5_ROOTS');
  roots.forEach(requireUuid);
  if(enabled&&get('UCELL_ADMIN_DEV_READ_ONLY')==='true')throw new Error('ANALYTICS_REFRESH_FORBIDDEN_IN_READ_ONLY_DEV');
  return {enabled,seconds,scopes:['GLOBAL',...roots]};
}
export function refreshKey(scope:string,bucket:number){
  const hash=createHash('sha256').update(`${ANALYTICS_POLICY.version}|${scope}|${bucket}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
const safeCode=(error:unknown)=>{
  const message=error instanceof Error?error.message:'';
  return ['ANALYTICS_REBUILD_IN_PROGRESS','ANALYTICS_EVENT_OWNER_UNAVAILABLE','QUALIFICATION_NOT_FOUND'].find(code=>message.includes(code))??'ANALYTICS_REFRESH_FAILED';
};
@Injectable()
export class AnalyticsRefreshWorker implements OnApplicationBootstrap,OnApplicationShutdown {
  private readonly log=new Logger(AnalyticsRefreshWorker.name);
  readonly config:ReturnType<typeof refreshConfiguration>;
  private timer?:ReturnType<typeof setTimeout>;
  private stopping=false;
  private task?:Promise<void>;
  private state:{running:boolean;lastStartedAt:string|null;lastFinishedAt:string|null;lastSuccessAt:string|null;results:Array<{scope:string;status:string;snapshotId?:string;code?:string}>}
    ={running:false,lastStartedAt:null,lastFinishedAt:null,lastSuccessAt:null,results:[]};
  constructor(private readonly service:AnalyticsService,config:ConfigService){this.config=refreshConfiguration(key=>config.get<string>(key));}
  onApplicationBootstrap(){if(this.config.enabled)this.schedule(0);}
  private schedule(delay:number){this.timer=setTimeout(()=>{void this.runOnce().finally(()=>{if(!this.stopping)this.schedule(this.config.seconds*1000);});},delay);this.timer.unref();}
  async onApplicationShutdown(){this.stopping=true;if(this.timer)clearTimeout(this.timer);await this.task;}
  async status(){return {...this.config,...this.state,processStatusResetsOnRestart:true,scopeFreshness:await this.service.scopeFreshness(this.config.scopes)};}
  runOnce():Promise<void>{
    if(this.task)return this.task;
    if(!this.config.enabled||this.stopping)return Promise.resolve();
    this.task=this.cycle().finally(()=>{this.task=undefined;});return this.task;
  }
  private async cycle(){
    this.state={...this.state,running:true,lastStartedAt:new Date().toISOString(),results:[]};
    const bucket=Math.floor(Date.now()/(this.config.seconds*1000));
    try{
      for(const scope of this.config.scopes){
        if(this.stopping)break;
        const key=refreshKey(scope,bucket);let result:{snapshotId:string}|undefined,code='ANALYTICS_REFRESH_FAILED';
        for(let attempt=0;attempt<3;attempt++){
          try{result=await this.service.rebuild(key,scope==='GLOBAL'?undefined:scope,'SYSTEM:ANALYTICS_REFRESH');break;}
          catch(error){code=safeCode(error);if(attempt<2&&!this.stopping)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}
          if(this.stopping)break;
        }
        if(result)this.state.results.push({scope,status:'SUCCESS',snapshotId:result.snapshotId});
        else{this.state.results.push({scope,status:'FAILED',code});this.log.warn(`Management analytics refresh failed: ${code}`);}
      }
      if(this.state.results.length===this.config.scopes.length&&this.state.results.every(r=>r.status==='SUCCESS'))this.state.lastSuccessAt=new Date().toISOString();
    }finally{this.state.running=false;this.state.lastFinishedAt=new Date().toISOString();}
  }
}
