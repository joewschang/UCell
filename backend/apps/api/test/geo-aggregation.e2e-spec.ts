import {aggregateGeo,GeoBallFact} from '../src/modules/organization-geo/geo-aggregation';
const context={side:'ALL' as const,level:'CITY' as const,periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-10-01T00:00:00Z',gpvAvailable:true};
const ball=(id:string,side:'LEFT'|'RIGHT',person='P'):GeoBallFact=>({qualificationId:id,personId:person,ownerType:'MEMBER',firstSide:side,placedAt:'2026-09-03T00:00:00Z',active:'ACTIVE',cityCode:'63000',districtCode:'63000030'});
describe('Geo grains and source reconciliation',()=>{
 it('counts three balls once per Person and reconciles branch/source totals',()=>{
  const result=aggregateGeo([ball('A','LEFT'),ball('B','RIGHT'),ball('C','RIGHT')],[{eventId:'E',qualificationId:'A',firstSide:'LEFT',occurredAt:'2026-09-05T00:00:00Z',netGpv:'80'}],context);
  expect(result.summary).toMatchObject({descendantBalls:3,uniqueMembers:1,leftBalls:1,rightBalls:2,gpv:'80.0000'});
  expect(result.distribution.reduce((sum,r)=>sum+r.balls,0)).toBe(3);
  expect(result.branchComparison[0].left.gpv).toBe('80.0000');
 });
 it('retains unlocated/LegalEntity balls and missing Active/GPV evidence',()=>{
  const result=aggregateGeo([{...ball('A','LEFT'),cityCode:null,districtCode:null,active:'UNKNOWN' as const},{...ball('B','RIGHT'),personId:null,ownerType:'LEGAL_ENTITY'}],[],{...context,gpvAvailable:false});
  expect(result.summary).toMatchObject({balls:2,members:1,eligibleMemberBalls:1,unlocatedBalls:1,unknownActiveBalls:1,activeRate:null,gpv:null});
 });
 it('rejects duplicate source evidence',()=>{
  expect(()=>aggregateGeo([ball('A','LEFT'),ball('A','LEFT')],[],context)).toThrow('GEO_DUPLICATE_BALL_EVIDENCE');
  const event={eventId:'E',qualificationId:'A',firstSide:'LEFT',occurredAt:context.periodStart,netGpv:'1'};
  expect(()=>aggregateGeo([ball('A','LEFT')],[event,event],context)).toThrow('GEO_DUPLICATE_GPV_SOURCE');
 });
 it('uses half-open period and historical firstSide',()=>{
  const result=aggregateGeo([ball('A','LEFT'),ball('B','RIGHT')],[{eventId:'START',qualificationId:'A',firstSide:'LEFT',occurredAt:context.periodStart,netGpv:'3'},{eventId:'END',qualificationId:'A',firstSide:'LEFT',occurredAt:context.periodEnd,netGpv:'5'}],{...context,side:'LEFT'});
  expect(result.summary).toMatchObject({balls:1,gpv:'3.0000'});
 });
});
