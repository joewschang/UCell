import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {EconomicLineagePage,lineageEvents} from './EconomicLineagePage';
import {RequirePageRole} from '../auth/RequirePageRole';
const auth=vi.hoisted(()=>({role:'FINANCE'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:auth.role}})}));
vi.mock('../../lib/api',()=>({get:vi.fn()}));
const fixture={order:{orderNo:'123',status:'PAID'},payments:[],economicEvidence:{pvEvents:[{reference:'hidden-pv-ref',pvType:'GPV',amount:'100',occurredAt:'2026-09-01T00:00:00Z'}],awards:[{reference:'hidden-award-ref',sourcePvReference:'hidden-pv-ref',awardType:'RETAIL_REFERRAL',theoryAmount:'10',payableAmount:'0',activeAtRecognition:false,occurredAt:'2026-09-02T00:00:00Z',privateNote:'DO-NOT-RENDER'}],periodContributions:[{kind:'GLOBAL',periodEnd:'2026-09-30T00:00:00Z',orderOriginalGpv:'100',periodContext:{recipients:[{awardType:'GLOBAL',originallyPosted:'500'}],corrections:[]}}],returnReplays:[{status:'MAX_HORIZON',evidenceType:'CALCULATION_CHECKPOINT_NOT_PAYMENT',periods:[]}],recoveries:[{recoveryAmount:'2',applications:[{amount:'1',basis:'RECOVERY_OFFSET_NOT_CASH_PAYMENT'}]}]}};
beforeEach(()=>{auth.role='FINANCE';vi.mocked(get).mockReset().mockResolvedValue({data:fixture});});
async function render(path='/economic-lineage?orderNo=123'){
 let view!:ReturnType<typeof create>;
 await act(async()=>{view=create(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RequirePageRole><EconomicLineagePage/></RequirePageRole></QueryClientProvider></MemoryRouter>);});
 return view;
}
it('renders chronological, expandable zero-entitlement evidence and separate period/checkpoint meanings',async()=>{
 const view=await render();await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('零售推薦獎金'));
 const output=JSON.stringify(view.toJSON());
 for(const text of ['GPV 認列 1','可得金額','認列時有效','整期背景（不歸給單筆訂單）','這是重算進度，不能視為已入帳或已付款。','此筆為追回款抵扣，並非現金付款。'])expect(output).toContain(text);
 for(const secret of ['hidden-pv-ref','hidden-award-ref','DO-NOT-RENDER'])expect(output).not.toContain(secret);
 expect(view.root.findAllByType('button')).toHaveLength(1);
 expect(view.root.findAllByType('details').length).toBeGreaterThan(2);
 expect(lineageEvents(fixture).slice(0,3).map(row=>row.title)).toEqual(['PV 認列','零售推薦獎金','期間結算背景']);
 expect(get).toHaveBeenCalledWith('/admin/operations/economic-lineage/orders/123',expect.objectContaining({signal:expect.any(AbortSignal)}));
 act(()=>view.unmount());
});
it('renders historical retail inputs and distinguishes missing snapshots',async()=>{
 const evidence={...fixture,economicEvidence:{awards:[{awardType:'RETAIL_REFERRAL',retailRecognition:{sku:'HISTORICAL-SKU',baseAmount:'100',rate:'0.1',baseType:'NET_PAID_ITEM_AMOUNT',calculationType:'PERCENTAGE',attribution:{source:'RETAIL_CHECKOUT_CANDIDATE_REVALIDATED',reference:'PRIVATE-REFERENCE'},privateNote:'PRIVATE-INPUT'}},{awardType:'RETAIL_REFERRAL',retailRecognition:null}]}};
 vi.mocked(get).mockResolvedValue({data:evidence});
 const view=await render();await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('HISTORICAL-SKU'));
 const output=JSON.stringify(view.toJSON());
 for(const label of ['商品實付淨額','按比例','認列比例','結帳時驗證推薦歸屬','缺少歷史認列快照'])expect(output).toContain(label);
 for(const secret of ['PRIVATE-REFERENCE','PRIVATE-INPUT'])expect(output).not.toContain(secret);
 act(()=>view.unmount());
});
it('shows stored input conditions without claiming zero award or completed recognition',async()=>{
 vi.mocked(get).mockResolvedValue({data:{...fixture,economicEvidence:{retailRecognitionInputs:[{basis:'STORED_INPUT_NOT_RECOGNITION_RESULT',awardEvidence:'NO_RECORDED_AWARD',inputConditions:['RETAIL_REFERRAL_DISABLED','NO_STORED_REFERRER'],recordedAt:'2026-09-01T00:00:00Z'},{basis:'STORED_INPUT_NOT_RECOGNITION_RESULT',awardEvidence:'NO_RECORDED_AWARD',inputConditions:[]}]}}});
 const view=await render();await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('零售推薦認列輸入'));
 const output=JSON.stringify(view.toJSON());
 for(const label of ['當時未啟用零售推薦','當時未記錄推薦人','不推定為零金額或認列完成','實際資格與處理結果仍須認列證據'])expect(output).toContain(label);
 expect(output).not.toContain('可得金額');act(()=>view.unmount());
});
it('distinguishes recorded zero consumption from missing eligible PV',async()=>{
 vi.mocked(get).mockResolvedValue({data:{...fixture,economicEvidence:{consumptionRecognitions:[{basis:'RECORDED_CONSUMPTION_DECISION',pvType:'EPV',eligible:false,eligibleAmount:'0',exclusionReasonCode:'ZERO_ELIGIBLE_AMOUNT',volumeEvidence:'NO_RECORDED_VOLUME',recognizedAt:'2026-09-01T00:00:00Z'},{basis:'RECORDED_CONSUMPTION_DECISION',pvType:'GPV',eligible:true,eligibleAmount:'100',volumeEvidence:'NO_RECORDED_VOLUME'}]}}});
 const view=await render();await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('消費認列結果'));
 const output=JSON.stringify(view.toJSON());
 for(const label of ['符合資格的認列量','符合資格的金額為零','已記錄為不符合認列資格，認列量為零。','尚無對應 PV 紀錄；不能推定已完成後續入帳。'])expect(output).toContain(label);
 expect(output).not.toContain('可得金額');act(()=>view.unmount());
});
it('hides cached financial evidence after a failed refresh and allows retry',async()=>{
 const view=await render();await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('零售推薦獎金'));
 vi.mocked(get).mockRejectedValueOnce(new Error('連線失敗'));
 await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}});});
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('連線失敗'));
 expect(JSON.stringify(view.toJSON())).not.toContain('零售推薦獎金');
 vi.mocked(get).mockResolvedValue({data:{order:{orderNo:'123',status:'PAID'},economicEvidence:{}}});
 await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}});});
 await vi.waitFor(()=>expect(JSON.stringify(view.toJSON())).toContain('目前沒有可追溯的經濟紀錄'));
 act(()=>view.unmount());
});
it('validates order numbers before requesting evidence',async()=>{
 const view=await render('/economic-lineage');expect(get).not.toHaveBeenCalled();
 await act(async()=>{view.root.findByType('input').props.onChange({target:{value:'../../private'}});});
 await act(async()=>{view.root.findByType('form').props.onSubmit({preventDefault(){}});});
 expect(JSON.stringify(view.toJSON())).toContain('請輸入 1 至 19 位數字');expect(get).not.toHaveBeenCalled();act(()=>view.unmount());
});
it('denies membership operators before loading financial evidence',async()=>{
 auth.role='MEMBERSHIP_OPS';const view=await render();expect(get).not.toHaveBeenCalled();expect(JSON.stringify(view.toJSON())).toContain('無權存取');act(()=>view.unmount());
});
