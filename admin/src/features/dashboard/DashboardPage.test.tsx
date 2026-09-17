import React from 'react';
import {create} from 'react-test-renderer';
import {describe,expect,it,vi} from 'vitest';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
import {canReadDashboardCompensation,DashboardContent} from './DashboardPage';

const summary={generatedAt:'2026-09-18T00:00:00.000Z',persons:10,qualifications:12,activeQualifications:8,applications:{draft:2,submitted:3},orders:{today:4,month:20},recoveries:{open:1},payable:{open:6},ruleVersionCode:'R1.0B'};
const compensation={generatedAt:'2026-09-18T00:00:00.000Z',latestSettlements:[{settlementBatchId:'s1',settlementType:'BINARY_K1',periodEnd:'2026-09-14T16:00:00.000Z',status:'FINALIZED',ruleVersionCode:'R1.0B'}],awards:{pending45d:5,effective:7},recoveries:{openCount:1,outstanding:'100'}};

describe('DashboardContent authoritative read models',()=>{
 it('renders only values supplied by existing read models',()=>{const output=JSON.stringify(create(<DashboardContent summary={summary} compensation={compensation}/>).toJSON());expect(output).toContain('BINARY_K1');expect(output).toContain('最近 FINALIZED 批次');expect(output).toContain('45日等待期 Award');expect(output).toContain('目前無權威資料')});
 it('does not derive unavailable lifecycle, GMV, organization, settlement progress, or security values',()=>{const output=JSON.stringify(create(<DashboardContent summary={summary}/>).toJSON());expect(output).toContain('不得推導其他狀態');expect(output).toContain('GMV、付款與退貨彙總尚未');expect(output).toContain('不推定目前結算進度');expect(output).toContain('不得以 Audit 筆數替代安全事件');expect(output).not.toContain('NT$0')});
 it('gates compensation evidence with the backend endpoint roles',()=>{
  expect(canReadDashboardCompensation('SUPER_ADMIN')).toBe(true);
  expect(canReadDashboardCompensation('FINANCE')).toBe(true);
  expect(canReadDashboardCompensation('COMPLIANCE_AUDIT')).toBe(true);
  expect(canReadDashboardCompensation('ORDER_OPS')).toBe(false);
  expect(canReadDashboardCompensation('CUSTOMER_SERVICE')).toBe(false);
  const output=JSON.stringify(create(<DashboardContent summary={summary} canReadCompensation={false}/>).toJSON());
  expect(output).toContain('目前角色未獲授權');
  expect(output).toContain('不會發出該 API request');
  expect(output).not.toContain('BINARY_K1');
 });
});
