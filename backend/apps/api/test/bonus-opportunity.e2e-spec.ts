import {Prisma, equalizationRequirement, opportunityReasons, recordBonusOpportunities, invalidateBonusOpportunities} from '@ucell/database';
import {lineNotificationSender} from '../../worker/src/line-notification-adapter';

const D=(v:string|number)=>new Prisma.Decimal(v);
function store(){
 const rows:any[]=[];const notices:any[]=[];const events:any[]=[];const deliveries:any[]=[];
 const tx:any={qualification:{findUnique:async()=>({kind:'MEMBER_ORIGIN'})},qualificationHolderHistory:{findFirst:async()=>({holderPersonId:'historical-holder'})},bonusOpportunity:{findUnique:async({where}:any)=>rows.find(r=>r.opportunityKey===where.opportunityKey),create:async({data}:any)=>{const row={...data,bonusOpportunityId:`opp-${rows.length}`};rows.push(row);return row;}},memberNotification:{upsert:async({create}:any)=>{notices.push(create);return create;}},notificationDelivery:{create:async({data}:any)=>deliveries.push(data)},outboxEvent:{create:async({data}:any)=>events.push(data)}};
 return {tx,rows,notices,events,deliveries};
}
const candidate=(sourceKey='source-1')=>({recipientQualificationId:'q1',sourceKey,awardType:'EQUALIZATION',generation:5,theoreticalAmount:D(100),occurredAt:new Date('2026-10-31T06:35:00Z'),reasons:opportunityReasons(false,'STARTER','ELITE',1,3),parameterSnapshotHash:'hash',detail:{rate:'0.1'}});
describe('missed bonus opportunity evidence',()=>{
 it('retains all causes and derives the minimum unlock plan',()=>{
  expect(equalizationRequirement('STARTER',5)).toEqual({requiredPlan:'ELITE',requiredDirects:3});
  expect(equalizationRequirement('ELITE',7)).toEqual({requiredPlan:'LEADER',requiredDirects:4});
  expect(candidate().reasons.map(r=>r.code)).toEqual(['INACTIVE','PLAN_INSUFFICIENT','DIRECT_COUNT_INSUFFICIENT']);
 });
 it('keeps separate sources, one amount per opportunity and idempotent notifications',async()=>{
  const x=store();const batch={settlementBatchId:'batch',ruleVersionCode:'R1.0B'};
  const run=()=>recordBonusOpportunities(x.tx,batch,[candidate(),candidate('source-2')],D(100),D(300),[]);
  await run();await run();
  expect(x.rows).toHaveLength(2);expect(x.notices).toHaveLength(2);expect(x.events).toHaveLength(2);expect(x.deliveries).toHaveLength(2);
  expect(x.rows[0].estimatedAmount.toString()).toBe('100');
  expect(x.notices[0].personId).toBe('historical-holder');
  expect(x.notices[0].body).toContain('尚差 2 位');expect(x.notices[0].body).toContain('NT$100.00');
 });
 it('recomputes the pool and deducts the change in already earned awards',async()=>{
  const x=store();await recordBonusOpportunities(x.tx,{settlementBatchId:'batch',ruleVersionCode:'r'},[candidate()],D(100),D(100),[{recipientQualificationId:'q1',theoryAmount:D(40)}]);
  // Existing 40 becomes 20; new opportunity 50; net incremental opportunity 30.
  expect(x.rows[0].estimatedAmount.toString()).toBe('30');
 });
 it('does not notify zero amounts or company qualifications',async()=>{
  const x=store();await recordBonusOpportunities(x.tx,{settlementBatchId:'b',ruleVersionCode:'r'},[{...candidate(),theoreticalAmount:D(0)}],D(0),D(100),[]);
  x.tx.qualification.findUnique=async()=>({kind:'COMPANY_BOOTSTRAP'});
  await recordBonusOpportunities(x.tx,{settlementBatchId:'b',ruleVersionCode:'r'},[candidate()],D(0),D(100),[]);
  expect(x.events).toHaveLength(0);
 });
 it('fails closed when historical ownership is absent',async()=>{
  const x=store();x.tx.qualificationHolderHistory.findFirst=async()=>null;
  await expect(recordBonusOpportunities(x.tx,{settlementBatchId:'b',ruleVersionCode:'r'},[candidate()],D(0),D(100),[])).rejects.toThrow('HISTORICAL_HOLDER_MISSING');
 });
 it('creates an immediate pre-pool estimate even before a settlement pool exists',async()=>{
  const x=store();await recordBonusOpportunities(x.tx,{settlementBatchId:null,sourceEventId:'event',ruleVersionCode:'r'},[candidate()],D(0),D(0),[]);
  expect(x.rows[0].estimatedAmount.toString()).toBe('100');expect(x.rows[0].calculationDetail.amountKind).toBe('PRE_POOL_ESTIMATE');expect(x.notices[0].body).toContain('獎金池係數調整前');
 });
 it('withdraws a refund-affected estimate once while preserving original content',async()=>{
  const x=store();await recordBonusOpportunities(x.tx,{settlementBatchId:'b',ruleVersionCode:'r'},[candidate()],D(0),D(100),[]);
  const row=x.rows[0],original=row.message;
  x.tx.bonusOpportunity.findMany=async()=>row.reviewRequired?[]:[row];
  x.tx.bonusOpportunity.update=async({data}:any)=>Object.assign(row,data);
  x.tx.outboxEvent.upsert=jest.fn(async()=>({}));x.tx.memberNotification.upsert=jest.fn(async({create}:any)=>create);x.tx.notificationDelivery.upsert=jest.fn(async()=>({}));
  const input={batchIds:['b'],sourceKeys:[],actionKey:'refund'};
  await invalidateBonusOpportunities(x.tx,input);await invalidateBonusOpportunities(x.tx,input);
  expect(row.reviewRequired).toBe(true);expect(row.message).toBe(original);expect(x.tx.outboxEvent.upsert).toHaveBeenCalledTimes(1);
  expect(x.tx.memberNotification.upsert.mock.calls[0][0].create.body).toContain('原機會金額已失效');
 });
});
describe('LINE opportunity content and retries',()=>{
 const input={recipient:'Utest',notificationType:'BONUS_OPPORTUNITY',correlationId:'e0dc1f85-c379-4c3b-b9e7-6b62989cb62f',text:'未取得推薦獎金 NT$100.00'};
 it('sends the rendered content and stable retry UUID',async()=>{
  const request=jest.fn(async()=>new Response('',{status:200,headers:{'x-line-request-id':'accepted'}}));
  const sender=lineNotificationSender({LINE_MESSAGING_CHANNEL_ACCESS_TOKEN:'test'},request);
  await expect(sender.send(input)).resolves.toEqual({kind:'SENT',providerCorrelation:'accepted'});
  const options=(request.mock.calls as any)[0][1];expect(JSON.parse(options.body).messages[0].text).toBe(input.text);expect(options.headers['X-Line-Retry-Key']).toBe(input.correlationId);
 });
 it('treats an accepted duplicate as success and network failure as retryable',async()=>{
  await expect(lineNotificationSender({LINE_MESSAGING_CHANNEL_ACCESS_TOKEN:'test'},async()=>new Response('',{status:409,headers:{'x-line-accepted-request-id':'original'}})).send(input)).resolves.toEqual({kind:'SENT',providerCorrelation:'original'});
  await expect(lineNotificationSender({LINE_MESSAGING_CHANNEL_ACCESS_TOKEN:'test'},async()=>{throw Error('offline');}).send(input)).resolves.toEqual({kind:'RETRY',code:'LINE_NETWORK_ERROR'});
 });
 it('rejects missing content without an outbound request',async()=>{
  const request=jest.fn();await expect(lineNotificationSender({LINE_MESSAGING_CHANNEL_ACCESS_TOKEN:'test'},request).send({...input,text:undefined})).resolves.toEqual({kind:'FAILED',code:'LINE_NOTIFICATION_CONTENT_INVALID'});expect(request).not.toHaveBeenCalled();
 });
});
