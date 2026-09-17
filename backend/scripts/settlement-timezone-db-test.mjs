import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dirname} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {captureParameters}=require('../backend/apps/api/dist/modules/rules/parameter-snapshot.js');
const {SettlementCalendarService}=require('../backend/apps/api/dist/modules/settlement/settlement-calendar.service.js');
const url=new URL(process.env.DATABASE_URL??'');assert.match(url.pathname,/^\/(?:ucell_admin_test|ucell_jest_[a-f0-9]{32})$/);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const prisma=new PrismaClient(),results=[],rollback=new Error('ROLLBACK_TIMEZONE_TEST'),version='TIMEZONE_TEST_'+randomUUID();
function check(label,actual,expected){assert.deepEqual(actual,expected,label);results.push({label,result:'PASS',actual,expected});}
let failure;
try{
 await prisma.$transaction(async tx=>{
  for(const [parameterCode,valueJson] of [['settlement.timezone','Asia/Taipei'],['settlement.period',{unit:'WEEK',count:2,anchorLocal:'2020-01-01T00:00:00'}],['settlement.cut_off',{localTime:'13:15:00',daysAfterPeriodEnd:1,approvalReference:'TEST_ONLY_NOT_OPERATIONAL_APPROVAL'}]])
    await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode,scopeKey:'BINARY_K1',valueJson,effectiveFrom:new Date('2019-01-01')}});
  const snapshot=await captureParameters(tx,new Date('2020-01-05'),version),calendar=new SettlementCalendarService({});
  const period=await calendar.periodFor(tx,new Date('2020-01-05T12:00:00Z'),snapshot,'BINARY_K1');
  check('Taipei configured settlement week bounds',[period.start.toISOString(),period.end.toISOString(),period.timezone],['2019-12-31T16:00:00.000Z','2020-01-14T16:00:00.000Z','Asia/Taipei']);
  const before=await calendar.periodFor(tx,new Date('2019-12-31T15:59:59Z'),snapshot,'BINARY_K1');
  const at=await calendar.periodFor(tx,new Date('2019-12-31T16:00:00Z'),snapshot,'BINARY_K1');
  check('Taipei local-midnight boundary is deterministic',[before.end.toISOString(),at.start.toISOString()],['2019-12-31T16:00:00.000Z','2019-12-31T16:00:00.000Z']);
  throw rollback;
 },{isolationLevel:'Serializable',timeout:30000});
}catch(error){if(error!==rollback)failure=error;}finally{await prisma.$disconnect();}
const output=process.env.SETTLEMENT_TIMEZONE_EVIDENCE_PATH;if(!output)throw new Error('SETTLEMENT_TIMEZONE_EVIDENCE_PATH is required');
fs.mkdirSync(dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({result:failure?'FAIL':'PASS',fixturesRolledBack:true,results,...(failure?{error:failure.stack}:{})},null,2)+'\n');
if(failure){console.error(failure);process.exitCode=1;}else console.log('SETTLEMENT_TIMEZONE_DB_PASS');
