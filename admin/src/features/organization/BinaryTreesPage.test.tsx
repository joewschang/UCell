import React from 'react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get,command} from '../../lib/api';
import {BinaryTreesPage} from './BinaryTreesPage';
import {canOpen} from '../auth/permissions';
let role='COMPLIANCE_AUDIT';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role}})}));
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),qs:(v:Record<string,string>)=>'?'+new URLSearchParams(v).toString()}));
const id='10000000-0000-4000-8000-000000000001';
const result={binaryTreeId:id,treeCode:'TREE-A',treeName:'樹 A',status:'ACTIVE',topologyVersion:2,positions:Array.from({length:7},(_,i)=>({positionNo:i+1,parentPositionNo:i?Math.floor((i+1)/2):null,side:i%2?'LEFT':'RIGHT',qualificationId:i<3?'company-'+i:null,ownerType:i<3?'COMPANY':null,activeLabel:i<3?'Always Active (Company Rule)':null,descendantBalls:0,distinctMemberPersons:0,newBallsInPeriod:0}))};
beforeEach(()=>{role='COMPLIANCE_AUDIT';vi.mocked(get).mockReset().mockResolvedValue({data:{status:'PARTIAL',result}});vi.mocked(command).mockReset();});
async function render(){let view:ReturnType<typeof create>;await act(async()=>{view=create(<MemoryRouter initialEntries={['/admin/organization/trees/'+id]}><Routes><Route path="/admin/organization/trees/:id" element={<BinaryTreesPage/>}/></Routes></MemoryRouter>)});return view!;}
it('audit readers see company status and empty positions without write controls',async()=>{
 const view=await render(),output=JSON.stringify(view.toJSON());
 expect(output).toContain('Always Active (Company Rule)');expect(output).toContain('尚未占用');expect(output).toContain('金額統計目前不可用');
 expect(output).not.toContain('儲存名稱');expect(output).not.toContain('確認公司 Sponsor');expect(output).not.toContain('放置於選定位置');
 expect(get).toHaveBeenCalledWith(expect.stringContaining('knowledgeCutoff='));expect(command).not.toHaveBeenCalled();act(()=>view.unmount());
});
it('membership operators can confirm Sponsor but cannot override placement',async()=>{
 role='MEMBERSHIP_OPS';const view=await render(),output=JSON.stringify(view.toJSON());expect(output).toContain('確認公司 Sponsor');expect(output).not.toContain('放置於選定位置');act(()=>view.unmount());
});
it('placement operators receive only their command controls',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';const view=await render(),output=JSON.stringify(view.toJSON());expect(output).toContain('放置於選定位置');expect(output).not.toContain('儲存名稱');expect(output).not.toContain('確認公司 Sponsor');act(()=>view.unmount());
});
it('shows node totals separately from the paginated rows',async()=>{
 const view=await render();vi.mocked(get).mockResolvedValue({data:{status:'AVAILABLE',total:101,items:[{qualificationId:'node-1',parentQualificationId:'root',depth:13,side:'LEFT',ownerType:'MEMBER'}],nextCursor:id}});
 const button=view.root.findAllByType('button').find(b=>b.children.join('')==='載入節點')!;await act(async()=>button.props.onClick());
 const output=JSON.stringify(view.toJSON());expect(output).toContain('101');expect(output).toContain('13');expect(output).toContain('下一頁節點');expect(get).toHaveBeenLastCalledWith(expect.stringContaining('/nodes?'));act(()=>view.unmount());
});
it('does not substitute empty statistics when historical evidence is unavailable',async()=>{
 vi.mocked(get).mockResolvedValue({data:{status:'UNAVAILABLE',result:null,explainCode:'OWNER_EVIDENCE_UNAVAILABLE'}});const view=await render(),output=JSON.stringify(view.toJSON());expect(output).toContain('OWNER_EVIDENCE_UNAVAILABLE');expect(output).not.toContain('後代球數');act(()=>view.unmount());
});
it('grants only declared tree paths and roles',()=>{
 expect(canOpen('QUALIFICATION_PLACEMENT_OVERRIDE','/admin/organization/trees/'+id)).toBe(true);expect(canOpen('FINANCE','/admin/organization/trees')).toBe(false);expect(canOpen('SUPER_ADMIN','/admin/organization/trees/unregistered')).toBe(false);
});
