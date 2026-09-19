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
const result={binaryTreeId:id,treeCode:'TREE-A',treeName:'樹 A',status:'ACTIVE',topologyVersion:2,positions:Array.from({length:7},(_,i)=>({positionNo:i+1,binaryPositionNo:String(i+1),path:i?'L'.repeat(i):'',ballNo:i<3?'TREE-AX00000'+(i+1):null,parentPositionNo:i?Math.floor((i+1)/2):null,side:i%2?'LEFT':'RIGHT',qualificationId:i<3?'company-'+i:null,ownerType:i<3?'COMPANY':null,activeLabel:i<3?'Always Active (Company Rule)':null,descendantBalls:0,distinctMemberPersons:0,newBallsInPeriod:0}))};
beforeEach(()=>{role='COMPLIANCE_AUDIT';vi.mocked(get).mockReset().mockResolvedValue({data:{status:'PARTIAL',result}});vi.mocked(command).mockReset();});
async function render(){let view:ReturnType<typeof create>;await act(async()=>{view=create(<MemoryRouter initialEntries={['/admin/organization/trees/'+id]}><Routes><Route path="/admin/organization/trees/:id" element={<BinaryTreesPage/>}/></Routes></MemoryRouter>)});return view!;}
it('audit readers see company status and empty positions without write controls',async()=>{
 const view=await render(),output=JSON.stringify(view.toJSON());
 expect(output).toContain('Always Active (Company Rule)');expect(output).toContain('TREE-AX000001');expect(output).toContain('尚未占用');expect(output).toContain('Reservoir Center');expect(output).toContain('領袖 LEADER');expect(output).toContain('AVAILABLE');expect(output).not.toContain('company-0');
 expect(output).not.toContain('儲存名稱');expect(output).not.toContain('確認公司 Sponsor');expect(output).not.toContain('放置於選定位置');
 expect(get).toHaveBeenCalledWith(expect.stringContaining('knowledgeCutoff='));expect(command).not.toHaveBeenCalled();act(()=>view.unmount());
});
it('membership operators can confirm Sponsor but cannot override placement',async()=>{
 role='MEMBERSHIP_OPS';const view=await render(),output=JSON.stringify(view.toJSON());expect(output).toContain('確認公司 Sponsor');expect(output).not.toContain('放置於選定位置');act(()=>view.unmount());
});
it('placement operators receive only their command controls',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';const view=await render(),output=JSON.stringify(view.toJSON());expect(output).toContain('放置於選定位置');expect(output).not.toContain('儲存名稱');expect(output).not.toContain('確認公司 Sponsor');act(()=>view.unmount());
});
it('uses public Member and Ball identifiers when a canonical parent is selected for placement preview',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';const view=await render();
 const memberInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 2609000001')!;
 await act(async()=>memberInput.props.onChange({target:{value:'2609000001'}}));
 const rootBall=view.root.findAllByType('button').find(button=>button.props['aria-label']==='選擇 #1 公司球')!;
 await act(async()=>rootBall.props.onClick());
 vi.mocked(get).mockResolvedValueOnce({data:{preflightToken:'p'.repeat(64),actualSponsorSequenceNo:3,sponsorQualificationId:'hidden'}});
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='預檢選定位置')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('qualificationMemberNo=2609000001'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('binaryParentBallNo=TREE-AX000001'));
 expect(get).not.toHaveBeenLastCalledWith(expect.stringContaining('binaryParentQualificationId='));
 act(()=>view.unmount());
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

it('requests and reloads background statistics using the same server query and applied cutoff',async()=>{
 const query={metrics:['founding.statistics'],filters:{binaryTreeId:id},time:{asOf:'2026-09-01T00:00:00.000Z'}};
 const statistics={required:true,projectionStatus:'STALE',snapshot:null,dataThrough:null,projectedAt:null,query};
 vi.mocked(get).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,statistics}}});
 const view=await render(),originalUrl=vi.mocked(get).mock.calls[0][0];
 vi.mocked(command).mockResolvedValue({data:{jobId:id,status:'REQUESTED'}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='建立此截點的統計')!.props.onClick());
 expect(command).toHaveBeenCalledWith('/admin/analytics/period-projections/jobs',{query,mode:'REBUILD'});
 vi.mocked(get).mockResolvedValueOnce({data:{status:'COMPLETED'}}).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,statistics:{...statistics,projectionStatus:'CURRENT',snapshot:id}}}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='檢查統計工作')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(originalUrl);expect(JSON.stringify(view.toJSON())).toContain('CURRENT');act(()=>view.unmount());
});
it('carries the server snapshot token through pagination and child expansion',async()=>{
 const view=await render();
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:101,snapshotToken:'fixed-snapshot',nextCursor:'cursor-1',items:[{qualificationId:'parent-node',ballNo:'TREE-A000004',binaryPositionNo:'4',path:'LL',parentQualificationId:null,depth:0,ownerType:'COMPANY'}]}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='載入節點')!.props.onClick());
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:101,snapshotToken:'fixed-snapshot',nextCursor:null,items:[{qualificationId:'last-node',parentQualificationId:'parent-node',depth:1,ownerType:'MEMBER'}]}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='下一頁節點')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('snapshotToken=fixed-snapshot'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('after=cursor-1'));
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:0,snapshotToken:'fixed-snapshot',nextCursor:null,items:[],parentQualificationId:'last-node'}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='展開子節點')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('snapshotToken=fixed-snapshot'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('parentQualificationId=last-node'));act(()=>view.unmount());
});
