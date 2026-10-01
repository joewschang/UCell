vi.mock('./MaturedPayableSources',()=>({MaturedPayableSources:()=>null}));
vi.mock('./OperationsCompanyHealth',()=>({OperationsCompanyHealth:()=>null}));
vi.mock('./OperationsWorkflowHealth',()=>({OperationsWorkflowHealth:()=>null}));
vi.mock('./OperationsFinancialHealth',()=>({OperationsFinancialHealth:()=>null}));
import {act,create} from 'react-test-renderer';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {expect,it,vi} from 'vitest';
import {OperationsControlPage} from './OperationsControlPage';
import * as api from '../../lib/api';
vi.mock('./OperationsWorkItems',()=>({CandidateTaskForm:()=>null,OperationsWorkItems:()=>null}));
vi.mock('../../lib/api',async()=>({...await vi.importActual('../../lib/api'),get:vi.fn()}));
it('shows bounded coverage and actionable evidence, retaining the creation horizon on the next page',async()=>{
 const row={reference:'ERP-PROJECTION-'+'a'.repeat(40),stream:'SALES',state:'RECONCILED',orderNo:'100',fulfillmentKey:null,requestedAt:'2026-09-29T00:00:00Z',acknowledgedAt:null,reconciledAt:'2026-09-30T00:00:00Z',elapsedHours:24,thresholdHours:null,exceptionReferences:['ERP-EXCEPTION-abc'],blockedReason:null,link:'/erp-reconciliation?stream=SALES&projection=sample',candidate:{code:'ERP_OPEN_EXCEPTION',severity:'HIGH',evidenceHash:'b'.repeat(64)}};
 vi.mocked(api.get).mockResolvedValue({data:{items:[row],counts:{RECONCILED:1},observed:1,candidateCount:1,latestSuccessfulReconciliation:row.reconciledAt,nextCursor:'next-page',asOf:'2026-09-29T00:00:00Z',dataThrough:'2026-09-30T00:00:00Z',coverage:'CURRENT_PAGE_ONLY'}} as any);
 let tree:any;await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><OperationsControlPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,100));});
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('不代表全系統總量');expect(text).toContain('對帳相符不會自動結案');expect(tree.root.findByProps({href:row.link})).toBeTruthy();expect(api.get).toHaveBeenCalledWith('/admin/operations/control/erp-health?stream=SALES&take=25');
 await act(async()=>tree.root.findAllByType('button').find((button:any)=>button.children.includes('下一頁')).props.onClick());expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining('cursor=next-page&asOf=2026-09-29T00%3A00%3A00Z'));
 await act(async()=>tree.unmount());
});

it('loads the linked ERP fulfillment stream with the original operational threshold',async()=>{
 vi.stubGlobal('window',{location:{search:'?stream=FULFILLMENT&thresholdHours=48'}});
 vi.mocked(api.get).mockClear().mockResolvedValue({data:{items:[],counts:{},observed:0,candidateCount:0,latestSuccessfulReconciliation:null,nextCursor:null,asOf:'2026-10-01T00:00:00Z',dataThrough:'2026-10-01T00:00:00Z'}} as any);
 let tree:any;try{await act(async()=>{tree=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><OperationsControlPage/></QueryClientProvider>);await new Promise(resolve=>setTimeout(resolve,80));});expect(api.get).toHaveBeenCalledWith('/admin/operations/control/erp-health?stream=FULFILLMENT&thresholdHours=48&take=25');expect(tree.root.findByType('select').props.value).toBe('FULFILLMENT');expect(tree.root.findByType('input').props.value).toBe('48');}finally{if(tree)act(()=>tree.unmount());vi.unstubAllGlobals();}
});
