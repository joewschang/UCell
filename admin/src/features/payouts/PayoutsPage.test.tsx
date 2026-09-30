import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {PayoutsPage} from './PayoutsPage';
import {PayoutResultForm} from './PayoutResultForm';
import {Field,Metric} from '../../components/ui';
import {get,command} from '../../lib/api';
import {saveFinanceReviewDownload} from './payout-download';
const state=vi.hoisted(()=>({role:'FINANCE',status:'APPROVED'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:state.role,personId:'current-actor'}})}));
vi.mock('../../components/ConfirmAction',()=>({ConfirmAction:({children,onConfirm,disabled}:any)=><button disabled={disabled} onClick={onConfirm}>{children}</button>}));
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),qs:()=>'',ApiError:class extends Error{}}));
vi.mock('./payout-download',()=>({saveFinanceReviewDownload:vi.fn().mockResolvedValue(undefined)}));
beforeEach(()=>{state.role='FINANCE';state.status='APPROVED';vi.mocked(command).mockReset().mockResolvedValue({data:{}});vi.mocked(get).mockReset().mockImplementation(async url=>{
 const data={payoutBatchId:'batch-a',status:state.status,periodStart:'2026-01-01Z',periodEnd:'2026-02-01Z',totalGross:'100',totalRecovery:'0',totalNet:'100',approvals:[{stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:'another-finance'},...(state.status==='APPROVED'?[{stage:'COMPLIANCE_REVIEW',decision:'APPROVED',actorId:'another-auditor'}]:[])],lines:[{payoutLineId:'line-a',recipientQualificationId:'private-qualification',grossAmount:'100',recoveryOffset:'0',netAmount:'100',recipient:{ballNo:'BALL-100',currentHolder:{memberNo:'M100',legalName:'Synthetic member'}}}]};
 const detail={...data,exportArtifacts:state.status==='EXPORTED'?[{revision:1,formatVersion:'GENERIC_FINANCE_CSV_V2',contentHash:'a'.repeat(64),exportReference:'EXPORT-1',generatedAt:'2026-02-01T00:00:00Z'}]:[]};
 return {data:url.endsWith('/batch-a')?detail:url.endsWith('/payout-batches')?[data]:[]};
 });});
async function render(){let view:ReturnType<typeof create>;await act(async()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PayoutsPage/></QueryClientProvider>);});await vi.waitFor(()=>expect(view!.root.findAllByProps({className:'list-row '})).toHaveLength(1));await act(async()=>view!.root.findByProps({className:'list-row '}).props.onClick());await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('BALL-100'));return view!;}
it('opens an exact business-reference deep link outside the first queue page',async()=>{
 const reference='PAYOUT-'+'a'.repeat(40),original=vi.mocked(get).getMockImplementation()!;vi.stubGlobal('window',{location:{search:'?reference='+reference}});
 vi.mocked(get).mockImplementation((url,options)=>original(url.endsWith(reference)?'/admin/operations/payout-batches/batch-a':url,options));let view:ReturnType<typeof create>|undefined;
 try{await act(async()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PayoutsPage/></QueryClientProvider>);});await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('BALL-100'));expect(get).toHaveBeenCalledWith('/admin/operations/payout-batches/'+reference);}
 finally{if(view)act(()=>view!.unmount());vi.unstubAllGlobals();}
});
it('allows independent compliance approval at REVIEWED and hides qualification UUID text',async()=>{
 state.role='COMPLIANCE_AUDIT';state.status='REVIEWED';const view=await render();
 const button=view.root.findAllByType('button').find(b=>b.children.join('')==='獨立合規核准')!;expect(button.props.disabled).toBe(false);
 await act(async()=>button.props.onClick());expect(command).toHaveBeenCalledWith('/admin/operations/payout-batches/batch-a/approvals/COMPLIANCE_REVIEW',{note:'獨立合規核准'});
 expect(JSON.stringify(view.toJSON())).not.toContain('private-qualification');act(()=>view.unmount());
});
it('offers export at APPROVED with both recorded approvals',async()=>{
 const view=await render();act(()=>view.root.findAllByType(Field).find(f=>f.props.label==='匯出參考')!.findByType('input').props.onChange({target:{value:'EXPORT-1'}}));
 const button=view.root.findAllByType('button').find(b=>b.children.join('')==='建立財務覆核 CSV')!;expect(button.props.disabled).toBe(false);await act(async()=>button.props.onClick());
 expect(command).toHaveBeenCalledWith('/admin/operations/payout-batches/batch-a/export',{exportReference:'EXPORT-1'});act(()=>view.unmount());
});
it('shows failed-batch reconciliation only to Finance and preserves the same batch command scope',async()=>{
 state.status='FAILED';const view=await render();await act(async()=>view.root.findByType(PayoutResultForm).props.submit({results:[]}));expect(command).toHaveBeenCalledWith('/admin/operations/payout-batches/batch-a/payment-results',{results:[]});act(()=>view.unmount());
 state.role='COMPLIANCE_AUDIT';const audit=await render();expect(audit.root.findAllByType(PayoutResultForm)).toHaveLength(0);act(()=>audit.unmount());
});
it('downloads a specific immutable revision only through the Finance action',async()=>{
 state.status='EXPORTED';const view=await render();const button=view.root.findAllByType('button').find(b=>b.children.join('')==='下載第 1 版覆核 CSV')!;expect(button).toBeDefined();
 await act(async()=>button.props.onClick());expect(command).toHaveBeenCalledWith('/admin/operations/payout-batches/batch-a/export-downloads',{revision:1});expect(saveFinanceReviewDownload).toHaveBeenCalled();act(()=>view.unmount());
 state.role='COMPLIANCE_AUDIT';const audit=await render();expect(audit.root.findAllByType('button').some(b=>b.children.join('')==='下載第 1 版覆核 CSV')).toBe(false);act(()=>audit.unmount());
});
it('keeps unavailable amounts unknown and offers retry instead of claiming empty financial data',async()=>{
 vi.mocked(get).mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PayoutsPage/></QueryClientProvider>);});
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('無法取得付款批次'));
 expect(view!.root.findAllByType(Metric).map(metric=>metric.props.value)).toEqual(['—','—']);
 expect(JSON.stringify(view!.toJSON())).not.toContain('目前沒有符合狀態的付款批次');
 vi.mocked(get).mockResolvedValue({data:[]});const retry=view!.root.findAllByType('button').find(button=>button.children.join('')==='重新載入')!;
 expect(retry.props.disabled).toBe(false);await act(async()=>retry.props.onClick());
 await vi.waitFor(()=>expect(view!.root.findAllByType(Metric).map(metric=>metric.props.value)).toEqual([0,0]));
 expect(JSON.stringify(view!.toJSON())).toContain('目前沒有符合狀態的付款批次');act(()=>view!.unmount());
});
it('retains export input but disables financial actions until stale detail can be refreshed',async()=>{
 const view=await render();act(()=>view.root.findAllByType(Field).find(f=>f.props.label==='匯出參考')!.findByType('input').props.onChange({target:{value:'KEEP-REFERENCE'}}));
 vi.mocked(get).mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));
 const client=view.root.findByType(QueryClientProvider).props.client;await act(async()=>client.invalidateQueries({queryKey:['payout-detail','batch-a']}));
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('批次明細更新失敗'));
 expect(view.root.findAllByType('button').find(button=>button.children.join('')==='建立財務覆核 CSV')!.props.disabled).toBe(true);
 expect(view.root.findAllByType(Field).find(field=>field.props.label==='匯出參考')!.findByType('input').props.value).toBe('KEEP-REFERENCE');
 expect(view.root.findAllByType('button').find(button=>button.children.join('')==='重新載入')!.props.disabled).toBe(false);act(()=>view.unmount());
});
