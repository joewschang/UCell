import React from 'react';
import {act,create} from 'react-test-renderer';
import {describe,expect,it,vi} from 'vitest';
import {SettlementJobsPage} from './SettlementJobsPage';

const role=vi.hoisted(()=>({value:'COMPLIANCE_AUDIT'}));
const feed=vi.hoisted(()=>({operational:undefined as any,queryKey:[] as unknown[]}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:role.value}})}));
vi.mock('@tanstack/react-query',()=>({
 useQueryClient:()=>({invalidateQueries:vi.fn()}),
 useMutation:()=>({mutate:vi.fn(),isPending:false,error:null}),
 useQuery:(options:any)=>{feed.queryKey=options.queryKey;return {isPending:false,isFetching:false,error:null,refetch:vi.fn(),data:{data:[{id:'internal-job-uuid',kind:'BINARY_K1',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-08T00:00:00.000Z',ruleVersionCode:'R1.0B',approvalReference:'FINANCE-APPROVED',createdAt:'2026-09-08T00:00:00.000Z',status:'DEAD',attemptCount:10,availableAt:'2026-09-08T00:00:00.000Z',lastError:'private stack with uuid',operational:feed.operational}]}};},
}));

describe('SettlementJobsPage',()=>{
 it('shows privacy-safe job status and keeps Compliance retry read-only',()=>{
  role.value='COMPLIANCE_AUDIT';const tree=create(<SettlementJobsPage/>),text=JSON.stringify(tree.toJSON());
  expect(text).toContain('雙軌獎金');expect(text).toContain('執行失敗');expect(text).toContain('上次執行失敗');
  expect(text).toContain('尚未套用逾時門檻');expect(text).toContain('套用逾時門檻');
  expect(text).not.toContain('internal-job-uuid');expect(text).not.toContain('private stack');
  expect(tree.root.findAllByType('button').find(button=>button.children.includes('重新排程'))?.props.disabled).toBe(true);
  tree.unmount();
 });
 it('shows explicit waits and applies the chosen threshold only after submission',()=>{
  feed.operational={jobReference:'PERIOD-JOB-safe',state:'WAITING_MATURITY',overdue:false,eligibleAt:'2027-01-01Z',maturesAt:'2027-01-01Z',waiting:{sourceEvents:0,recognitions:0,prerequisites:0},dependencies:[{reference:'PERIOD-JOB-parent',kind:'WELFARE',complete:true}]};
  const tree=create(<SettlementJobsPage/>);
  expect(feed.queryKey.at(-1)).toBeNull();
  const text=JSON.stringify(tree.toJSON());expect(text).toContain('等待獎金成熟');expect(text).toContain('福利提撥');expect(text).not.toContain('已逾查詢門檻');
  act(()=>tree.root.findAllByType('input').find(input=>input.props.type==='number')!.props.onChange({target:{value:'48'}}));
  expect(feed.queryKey.at(-1)).toBeNull();
  act(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  expect(feed.queryKey.at(-1)).toBe(48);expect(JSON.stringify(tree.toJSON())).toContain('48 小時');
  tree.unmount();feed.operational=undefined;
 });
});
