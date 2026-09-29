import React from 'react';
import {create} from 'react-test-renderer';
import {describe,expect,it,vi} from 'vitest';
import {SettlementJobsPage} from './SettlementJobsPage';

const role=vi.hoisted(()=>({value:'COMPLIANCE_AUDIT'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:role.value}})}));
vi.mock('@tanstack/react-query',()=>({
 useQueryClient:()=>({invalidateQueries:vi.fn()}),
 useMutation:()=>({mutate:vi.fn(),isPending:false,error:null}),
 useQuery:()=>({isPending:false,isFetching:false,error:null,refetch:vi.fn(),data:{data:[{id:'internal-job-uuid',kind:'BINARY_K1',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-08T00:00:00.000Z',ruleVersionCode:'R1.0B',approvalReference:'FINANCE-APPROVED',createdAt:'2026-09-08T00:00:00.000Z',status:'DEAD',attemptCount:10,availableAt:'2026-09-08T00:00:00.000Z',lastError:'private stack with uuid'}]}}),
}));

describe('SettlementJobsPage',()=>{
 it('shows privacy-safe job status and keeps Compliance retry read-only',()=>{
  role.value='COMPLIANCE_AUDIT';const tree=create(<SettlementJobsPage/>),text=JSON.stringify(tree.toJSON());
  expect(text).toContain('BINARY_K1');expect(text).toContain('DEAD');expect(text).toContain('上次執行失敗');
  expect(text).not.toContain('internal-job-uuid');expect(text).not.toContain('private stack');
  expect(tree.root.findAllByType('button').find(button=>button.children.includes('重新排程'))?.props.disabled).toBe(true);
  tree.unmount();
 });
});
