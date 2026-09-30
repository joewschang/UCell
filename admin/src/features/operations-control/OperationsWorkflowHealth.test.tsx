import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {OperationsWorkflowHealth} from './OperationsWorkflowHealth';
import * as api from '../../lib/api';
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn()}));
it('distinguishes approved eligibility age from stage age and preserves paging through blocked and healthy jobs',async()=>{
 const reference='PERIOD-JOB-'+'a'.repeat(16),asOf='2026-10-01T00:00:00.000Z';vi.mocked(api.get).mockResolvedValue({data:{items:[{reference,scope:'PERIOD_JOB',state:'WAITING_RECOGNITION',evidence:{kind:'REFERRAL_K0',periodStart:'2026-09-10T00:00:00Z',periodEnd:'2026-09-25T00:00:00Z',ruleVersionCode:'R1',waiting:{sourceEvents:0,recognitions:2,prerequisites:0},attemptCount:0,eligibleAt:asOf,maturesAt:null,completedAt:null,dependencies:[]},elapsedSinceEligibleHours:3,actionLink:'/settlement-jobs?reference='+reference,periodLink:null,candidates:[{code:'PERIOD_CLOSE_BLOCKED',evidenceHash:'b'.repeat(64)}]}],observed:1,attention:1,nextCursor:reference,asOf,dataThrough:asOf}} as any);
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><OperationsWorkflowHealth/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,80));});
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('等待月認列');expect(text).toContain('此時間不代表目前階段的進入時間');expect(text).toContain('結算門檻留白時不推定逾期');expect(tree.root.findByProps({href:'/settlement-jobs?reference='+reference})).toBeTruthy();expect(api.get).toHaveBeenCalledWith('/admin/operations/control/workflow-health?scope=PERIOD_JOB&take=25');
 await act(async()=>tree.root.findAllByType('button').find((row:any)=>row.children.includes('工作證據下一頁')).props.onClick());expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('cursor='+reference+'&asOf='+encodeURIComponent(asOf)));await act(async()=>tree.unmount());
});
