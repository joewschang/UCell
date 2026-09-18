import React from 'react';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {ReservoirCenterPage} from './ReservoirCenterPage';
import {canOpen} from '../auth/permissions';
vi.mock('../../lib/api',()=>({get:vi.fn(),qs:(v:Record<string,string|undefined>)=>'?'+new URLSearchParams(Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined)) as Record<string,string>).toString()}));
const time={timezone:'Asia/Taipei',asOf:'2026-09-18T01:00:00.000Z',knowledgeCutoff:'2026-09-18T01:00:00.000Z',periodStart:'2026-08-31T16:00:00.000Z',periodEnd:'2026-09-30T16:00:00.000Z'};
const row={id:'effect-1',effectType:'ENTITLEMENT',amount:'50000',tree:'tree-a',position:1,awardType:'REFERRAL',recordedAt:time.asOf,periodStart:time.periodStart,periodEnd:time.periodEnd,ruleVersion:'R1.0B'};
const ledger={kind:'B',time,status:'CURRENT',items:[row],total:101,periodInflow:'42000',cumulative:'42000',lastUpdated:time.asOf,dataThrough:time.asOf,nextCursor:'effect-1',snapshotToken:'snapshot-one',definitionVersion:'RESERVOIR_CENTER_V1'};
beforeEach(()=>{vi.mocked(get).mockReset().mockResolvedValue({data:ledger});});
async function render(){let view:ReturnType<typeof create>;await act(async()=>{view=create(<ReservoirCenterPage/>)});return view!;}
it('renders B separately from A and pages using the same server snapshot',async()=>{
 const view=await render();expect(JSON.stringify(view.toJSON())).toContain('42000');
 const next=view.root.findAllByType('button').find(b=>b.children.join('')==='下一頁')!;
 await act(async()=>next.props.onClick());expect(get).toHaveBeenLastCalledWith(expect.stringContaining('snapshotToken=snapshot-one'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('after=effect-1'));act(()=>view.unmount());
});
it('requests authoritative Explain with the entry period and renders signed corrections',async()=>{
 const view=await render();vi.mocked(get).mockResolvedValue({status:'AVAILABLE',explainCode:'VERIFIED_SOURCE',result:{amount:'-8000',kind:'CORRECTION',final:'50000',profile:'LEADER'},ruleVersion:'R1.0B',parameterVersion:'pv',evidenceRefs:[{type:'ReservoirBEffect',id:'effect-1'}]});
 const explain=view.root.findAllByType('button').find(b=>b.children.join('')==='Explain Reservoir B')!;
 await act(async()=>explain.props.onClick());expect(get).toHaveBeenLastCalledWith(expect.stringContaining('tool=explainReservoirB'));expect(JSON.stringify(view.toJSON())).toContain('-8000');act(()=>view.unmount());
});
it('shows denied/error states without retained ledger figures',async()=>{
 vi.mocked(get).mockRejectedValue(Error('403 沒有此操作權限'));const view=await render();expect(JSON.stringify(view.toJSON())).toContain('403');expect(JSON.stringify(view.toJSON())).not.toContain('42000');act(()=>view.unmount());
});
it('only Finance, Super Admin and Audit can open the Reservoir route',()=>{
 for(const role of ['FINANCE','SUPER_ADMIN','COMPLIANCE_AUDIT'] as const)expect(canOpen(role,'/admin/finance/reservoirs')).toBe(true);
 expect(canOpen('ORDER_OPS','/admin/finance/reservoirs')).toBe(false);expect(canOpen('MEMBERSHIP_OPS','/admin/finance/reservoirs')).toBe(false);
});
