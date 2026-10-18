import {periodCloseInputState} from '../../../packages/database/src/period-close-operational';

describe('package payment settlement barrier',()=>{
 const job={periodEnd:new Date('2026-10-18T00:00:00Z'),ruleVersionCode:'R1.0B'};
 function db(events:Array<{eventType:string;processStatus:string}>){return {
  outboxEvent:{count:async({where}:any)=>events.filter(e=>where.eventType.in.includes(e.eventType)&&e.processStatus!==where.processStatus.not).length},
  monthlyRecognitionSchedule:{count:async()=>0},
 } as any;}
 it.each(['PENDING','PROCESSING','DEAD'])('blocks a %s package recognition before closing',async processStatus=>{
  expect(await periodCloseInputState(db([{eventType:'PACKAGE_PAYMENT_CONFIRMED',processStatus}]),job)).toEqual({sourceEvents:1,recognitions:0,ready:false});
 });
 it('permits a fully processed package and unrelated pending profile event',async()=>{
  expect(await periodCloseInputState(db([{eventType:'PACKAGE_PAYMENT_CONFIRMED',processStatus:'PROCESSED'},{eventType:'DELIVERY_PROFILE_UPDATED',processStatus:'PENDING'}]),job)).toEqual({sourceEvents:0,recognitions:0,ready:true});
 });
});
