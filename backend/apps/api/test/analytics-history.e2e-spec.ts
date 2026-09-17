import { cohortRetention, historyRange, localDate, monthEndDate } from '../src/modules/analytics/analytics.history';
import { PersonState } from '../src/modules/analytics/analytics.policy';
const now=new Date('2026-09-18T04:00:00Z');
const state=(state:PersonState['state'],joinedMonth='2026-06'):PersonState=>({state,joinedMonth,reason:'TEST'});
const range=()=>historyRange({from:'2026-06-01',to:'2026-09-01',policyVersion:'test-v1'},now);
const observation=(asOf:string,states:Record<string,PersonState>,policyVersion='test-v1')=>({asOf,states,policyVersion});
describe('Analytics dated queries and fixed-cohort retention',()=>{
  test('date range uses exclusive Taipei midnight and includes exact requested length',()=>{
    const r=historyRange({from:'2026-09-01',to:'2026-09-02'},now);
    expect(r.from.toISOString()).toBe('2026-08-31T16:00:00.000Z');expect(r.to.toISOString()).toBe('2026-09-01T16:00:00.000Z');
    expect(localDate(now)).toBe('2026-09-18');expect(monthEndDate('2024-02')).toBe('2024-02-29');
  });
  test.each([{from:'2026-02-30',to:'2026-03-02'},{from:'2026-09-01'},{from:'2026-09-02',to:'2026-09-01'},{from:'2024-01-01',to:'2026-01-01'},{from:'2026-09-01',to:'2026-09-20'},{policyVersion:"x' OR true --"}])('rejects invalid range %j',input=>{expect(()=>historyRange(input,now)).toThrow();});
  test('fixed baseline, late additions excluded, missing people never inflate retention',()=>{
    const data=[observation('2026-06-30T12:00:00Z',{a:state('A'),b:state('A'),c:state('N')}),
      observation('2026-07-31T12:00:00Z',{a:state('A'),b:state('S'),c:state('A'),late:state('A')}),
      observation('2026-08-31T12:00:00Z',{a:state('A'),c:state('A')})];
    const june=cohortRetention(data,range(),now).rows[0];expect(june.baselineSize).toBe(3);expect(june.baselineActive).toBe(2);
    expect(june.cells[0]).toMatchObject({activeShare:2/3,activeRetention:1,status:'AVAILABLE'});
    expect(june.cells[1]).toMatchObject({activeShare:2/3,activeRetention:.5,status:'AVAILABLE'});
    expect(june.cells[2]).toMatchObject({observed:2,missing:1,status:'PARTIAL',activeShare:null,activeRetention:null});
  });
  test('does not substitute midmonth, different policies, or the next local month for a month-end observation',()=>{
    const data=[observation('2026-06-29T12:00:00Z',{a:state('A')}),observation('2026-06-30T12:00:00Z',{a:state('A')},'different'),observation('2026-06-30T16:00:00Z',{a:state('A')})];
    const june=cohortRetention(data,range(),now).rows[0];expect(june.baselineSize).toBeNull();expect(june.cells[1].status).toBe('BASELINE_NOT_OBSERVED');
  });
  test('selects last capture on month-end; no baseline Active denominator is unavailable',()=>{
    const data=[observation('2026-06-30T00:00:00Z',{a:state('A')}),observation('2026-06-30T15:59:00Z',{a:state('N')})];
    const june=cohortRetention(data,range(),now).rows[0];expect(june.cells[0]).toMatchObject({activeShare:0,activeRetention:null});expect(june.cells[1].status).toBe('MONTH_END_NOT_OBSERVED');
  });
  test('current month is never finalized and no future cohort data is fabricated',()=>{
    const r=historyRange({from:'2026-09-01',to:'2026-09-19',policyVersion:'test-v1'},now);
    const result=cohortRetention([observation(now.toISOString(),{a:state('A','2026-09')})],r,now);
    expect(result.rows[0].baselineSize).toBeNull();expect(result.rows[0].cells[0].status).toBe('MONTH_NOT_CLOSED');
  });
});
