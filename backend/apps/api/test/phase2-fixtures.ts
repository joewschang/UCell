import { Prisma, ReplayEnvelope, replayHash, HistoricalRecipient } from '@ucell/database';
export const d=(v:string|number)=>new Prisma.Decimal(v);
export function parameters(values:Record<string,string>={}){
 const body={format:'UCELL_PARAMETER_SNAPSHOT_V1' as const,ruleVersionCode:'TEST_ONLY',effectiveAt:'2020-01-01T00:00:00.000Z',parameters:Object.entries({'pool.referral.rate':'.42','pool.binary.rate':'.36','pool.matching.rate':'.15','binary.pair.rate':'.5',...values}).map(([code,value],i)=>({id:String(i),code,scope:'*',value,from:'2019-01-01T00:00:00.000Z',to:null}))};
 return {...body,hash:replayHash(body)};
}
export function recipient(overrides:Partial<HistoricalRecipient>={}):HistoricalRecipient{
 return {key:'award',awardId:'award',awardType:'BINARY',qualificationId:'root',generation:0,active:true,eligible:true,theory:'100',posted:'100',pendingUntil:'2020-03-01T00:00:00.000Z',detail:{},qualification:{plan:{planCode:'LEADER'},status:{status:'EFFECTIVE'},activeIntervals:[{activeFrom:'2019-01-01T00:00:00.000Z',activeTo:null}]},...overrides};
}
export function source(id='left',side='LEFT'):ReplayEnvelope{
 return {format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:id,ruleVersionCode:'TEST_ONLY',at:'2020-01-02T00:00:00.000Z',parameters:parameters(),recipients:[],evidence:{binary:[{parentQualificationId:'root',childQualificationId:id,side}],sponsor:[]},inputs:{qualificationId:id,volume:'1000',orderId:id,lineId:id}};
}
export function binary():ReplayEnvelope{
 return {format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:'batch',ruleVersionCode:'TEST_ONLY',at:'2020-01-08T00:00:00.000Z',parameters:parameters(),recipients:[recipient()],evidence:{sources:[source(),source('right','RIGHT')],carryRecipients:[{qualificationId:'root',leftCarryIn:'200',rightCarryIn:'0',leftCarryOut:'1000',rightCarryOut:'800',weeklyCapSnapshot:'200',active:true,qualification:recipient().qualification}]},inputs:{}};
}
export function epv(id='order',amount='4800'):ReplayEnvelope{
 return {...source(id),kind:'EPV',recipients:[recipient({awardType:'EPV',rate:'.5',posted:'840'})],inputs:{orderId:id,consumption:amount,volume:'1680',base:'2000',rate:'.6',timezone:'TEST_ONLY_UTC',qualificationId:'root'}};
}
export function sealed(envelope:ReplayEnvelope){return {snapshotId:'snapshot',ruleVersionCode:envelope.ruleVersionCode,content:envelope,hash:replayHash(envelope)};}
