import {PrismaClient} from '@prisma/client';
import {BinaryBonusService} from '../../src/modules/bonus/binary-bonus.service';
import {ReferralBonusService} from '../../src/modules/bonus/referral-bonus.service';
import {GlobalPoolService} from '../../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../../src/modules/global-pool/global-pool-persistence';
import {BonusQueryService} from '../../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../../src/modules/rules/runtime-rule.service';
import {SettlementCalendarService} from '../../src/modules/settlement/settlement-calendar.service';

// Test-only process: never expose an interrupt hook in production services.
async function main(){
  const [kind,rule,startText,endText,boundary]=process.argv.slice(2);
  const url=process.env.PHASE2_TEST_DATABASE_URL!;
  const target=new URL(url);
  if(!['localhost','127.0.0.1'].includes(target.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(target.pathname)||!rule.startsWith('TEST_CLOSE_'))throw new Error('Isolated settlement fixture required');
  if(!['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'].includes(kind)||!['BEFORE_SEAL','AFTER_COMMIT','COMPLETE'].includes(boundary))throw new Error('Invalid process test arguments');
  const db=new PrismaClient({datasources:{db:{url}}});
  let backendPid:number|undefined;
  async function pause(){
    process.send!({type:'READY',boundary,backendPid});
    setInterval(()=>{},1000);
    await new Promise(()=>{});
  }
  const client=new Proxy(db,{get(target,key){
    if(key!=='$transaction')return Reflect.get(target,key);
    return (work:any,options:any)=>target.$transaction(async tx=>{
      const rows=await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`;
      backendPid=rows[0].pid;
      const wrapped=new Proxy(tx,{get(transaction,property){
        if(property!=='historicalReplaySnapshot'||boundary!=='BEFORE_SEAL')return Reflect.get(transaction,property);
        return new Proxy(transaction.historicalReplaySnapshot,{get(delegate,method){
          if(method!=='create')return Reflect.get(delegate,method);
          return async()=>{await pause();throw new Error('Unreachable after process termination');};
        }});
      }});
      return work(wrapped);
    },options);
  }});
  try{
    const rules=new RuntimeRuleService(client as any),query=new BonusQueryService(client as any),calendar=new SettlementCalendarService(client as any);
    const start=new Date(startText),end=new Date(endText);
    if(kind==='GLOBAL')await new GlobalPoolService(client as any,rules,query,calendar,new GlobalPoolPersistence()).evaluateAndSettle(start,end,rule);
    else if(kind==='REFERRAL_K0')await new ReferralBonusService(client as any,rules,query,calendar).settle(start,end,rule);
    else{
      const binary=new BinaryBonusService(client as any,rules,query,calendar);
      if(kind==='MATCHING_K2')await binary.settleMatching(start,end,rule);
      else await binary.settleBinary(start,end,rule);
    }
    if(boundary==='AFTER_COMMIT')await pause();
    process.send!({type:'COMPLETE'});
  }finally{await db.$disconnect();}
}
main().then(()=>process.disconnect()).catch(error=>{
  process.send?.({type:'ERROR',message:error.message},()=>process.exit(1));
});
