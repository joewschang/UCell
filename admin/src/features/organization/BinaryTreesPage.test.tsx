import React from 'react';
import {MemoryRouter,Route,Routes,useNavigate} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {ApiError,get,command} from '../../lib/api';
import {BinaryTreesPage} from './BinaryTreesPage';
import {canOpen} from '../auth/permissions';
let role='COMPLIANCE_AUDIT';
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role}})}));
vi.mock('../../lib/api',()=>{
 class ApiError extends Error {constructor(public status:number,public body:unknown,message:string){super(message);}}
 return {ApiError,get:vi.fn(),command:vi.fn(),qs:(v:Record<string,string>)=>'?'+new URLSearchParams(v).toString()};
});
const id='10000000-0000-4000-8000-000000000001';
const result={binaryTreeId:id,treeCode:'TREE-A',treeName:'樹 A',status:'ACTIVE',topologyVersion:2,positions:Array.from({length:7},(_,i)=>({positionNo:i+1,binaryPositionNo:String(i+1),path:i?'L'.repeat(i):'',ballNo:i<3?'TREE-AX00000'+(i+1):null,parentPositionNo:i?Math.floor((i+1)/2):null,side:i%2?'LEFT':'RIGHT',qualificationId:i<3?'company-'+i:null,ownerType:i<3?'COMPANY':null,activeLabel:i<3?'Always Active (Company Rule)':null,companyProfile:i<3?{status:'AVAILABLE',planCode:'LEADER',profileVersion:'COMPANY_BOOTSTRAP_PROFILE_V1'}:null,descendantBalls:0,distinctMemberPersons:0,newBallsInPeriod:0}))};
beforeEach(()=>{role='COMPLIANCE_AUDIT';vi.mocked(get).mockReset().mockResolvedValue({data:{status:'PARTIAL',result}});vi.mocked(command).mockReset();});
async function render(){let view:ReturnType<typeof create>;await act(async()=>{view=create(<MemoryRouter initialEntries={['/admin/organization/trees/'+id]}><Routes><Route path="/admin/organization/trees/:id" element={<BinaryTreesPage/>}/></Routes></MemoryRouter>)});return view!;}
function deferred(){let resolve!: (value:unknown|PromiseLike<unknown>)=>void;return {promise:new Promise<unknown>(r=>{resolve=r}),resolve};}
function detail(treeId:string,treeCode:string,treeName:string){return {data:{status:'PARTIAL',result:{...result,binaryTreeId:treeId,treeCode,treeName}}};}
function TreeRouteSwitcher(){
 const navigate=useNavigate(),otherId='10000000-0000-4000-8000-000000000002';
 return <><button type="button" onClick={()=>navigate('/admin/organization/trees/'+id)}>切換至 A</button><button type="button" onClick={()=>navigate('/admin/organization/trees/'+otherId)}>切換至 B</button><Routes><Route path="/admin/organization/trees/:id" element={<BinaryTreesPage/>}/></Routes></>;
}
async function renderSwitcher(){let view:ReturnType<typeof create>;await act(async()=>{view=create(<MemoryRouter initialEntries={['/admin/organization/trees/'+id]}><TreeRouteSwitcher/></MemoryRouter>);await Promise.resolve();});return view!;}
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
 const rootBall=view.root.findAllByType('button').find(button=>String(button.props['aria-label']).includes('創始位置 #1'))!;
 await act(async()=>rootBall.props.onClick());
 vi.mocked(get).mockResolvedValueOnce({data:{preflightToken:'p'.repeat(64),actualSponsorSequenceNo:3,sponsorQualificationId:'hidden'}});
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='預檢選定位置')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('qualificationMemberNo=2609000001'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('binaryParentBallNo=TREE-AX000001'));
 expect(get).not.toHaveBeenLastCalledWith(expect.stringContaining('binaryParentQualificationId='));
 act(()=>view.unmount());
});
it('renders the complete safe authority preflight review and no internal sponsor identifier',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';const view=await render();
 const memberInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 2609000001')!;
 await act(async()=>memberInput.props.onChange({target:{value:'2609000001'}}));
 const parentInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 TREE-A000001')!;
 await act(async()=>parentInput.props.onChange({target:{value:'TREE-AX000001'}}));
 vi.mocked(get).mockResolvedValueOnce({data:{preflightToken:'p'.repeat(64),treeCode:'TREE-A',ballNo:'UNPLACED-2609000001',parentBallNo:'TREE-AX000001',expectedBinaryPositionNo:'4',expectedPath:'RLL',expectedBallNo:'TREE-A000001',expectedVersion:2,actualSponsorSequenceNo:3,sponsorQualificationId:'internal-sponsor-id'}});
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='預檢選定位置')!.props.onClick());
 const output=JSON.stringify(view.toJSON());
 expect(output).toContain('預檢可提交');expect(output).toContain('TREE-A');expect(output).toContain('TREE-AX000001');expect(output).toContain('Binary 位置 4');expect(output).toContain('RLL');expect(output).toContain('TREE-A000001');expect(output).toContain('Topology version');expect(output).toContain('這不是位置保留');
 expect(output).not.toContain('internal-sponsor-id');
 const rootBall=view.root.findAllByType('button').find(button=>String(button.props['aria-label']).includes('創始位置 #1'))!;
 expect(rootBall.props['aria-label']).toContain('Ball Number TREE-AX000001');expect(rootBall.props['aria-label']).toContain('Binary 位置 1');expect(rootBall.props['aria-label']).toContain('根位置');
 act(()=>view.unmount());
});
it('shows a safe receipt after placement and submits the preflight-bound version',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';const view=await render();
 const memberInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 2609000001')!;
 const parentInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 TREE-A000001')!;
 const reasonInput=view.root.findAllByType('input').find(input=>input.props.maxLength===500)!;
 await act(async()=>{memberInput.props.onChange({target:{value:'2609000001'}});parentInput.props.onChange({target:{value:'TREE-AX000001'}});reasonInput.props.onChange({target:{value:'UAT placement'}});});
 vi.mocked(get).mockResolvedValueOnce({data:{preflightToken:'p'.repeat(64),treeCode:'TREE-A',ballNo:'UNPLACED-2609000001',parentBallNo:'TREE-AX000001',expectedBinaryPositionNo:'4',expectedPath:'RLL',expectedBallNo:'TREE-A000001',expectedVersion:2,actualSponsorSequenceNo:3}});
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='預檢選定位置')!.props.onClick());
 vi.mocked(command).mockResolvedValueOnce({data:{binaryTreeId:id,treeCode:'TREE-A',ballNo:'TREE-A000001',parentBallNo:'TREE-AX000001',binaryPositionNo:'4',path:'RLL',topologyVersion:3,effectiveAt:'2026-09-19T01:02:03.000Z',binaryPlacementId:'internal-placement-id'}});
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='確認放置於選定位置')!.props.onClick());
 expect(command).toHaveBeenCalledWith('/admin/organization/trees/'+id+'/placements',expect.objectContaining({qualificationMemberNo:'2609000001',binaryParentBallNo:'TREE-AX000001',side:'LEFT',expectedVersion:2,preflightToken:'p'.repeat(64),reason:'UAT placement'}));
 const output=JSON.stringify(view.toJSON());
 expect(output).toContain('放置完成收據');expect(output).toContain('TREE-A000001');expect(output).toContain('2026-09-19T01:02:03.000Z');expect(output).not.toContain('internal-placement-id');
 act(()=>view.unmount());
});
it('clears a stale preflight on 409 and leaves the explicit parent choice untouched',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';const view=await render();
 const memberInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 2609000001')!;
 const parentInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 TREE-A000001')!;
 const reasonInput=view.root.findAllByType('input').find(input=>input.props.maxLength===500)!;
 await act(async()=>{memberInput.props.onChange({target:{value:'2609000001'}});parentInput.props.onChange({target:{value:'TREE-AX000001'}});reasonInput.props.onChange({target:{value:'UAT placement'}});});
 vi.mocked(get).mockResolvedValueOnce({data:{preflightToken:'p'.repeat(64),treeCode:'TREE-A',ballNo:'UNPLACED-2609000001',parentBallNo:'TREE-AX000001',expectedBinaryPositionNo:'4',expectedPath:'RLL',expectedBallNo:'TREE-A000001',expectedVersion:2,actualSponsorSequenceNo:3}});
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='預檢選定位置')!.props.onClick());
 vi.mocked(command).mockRejectedValueOnce(new ApiError(409,null,'conflict'));
 await act(async()=>view.root.findAllByType('button').find(button=>button.children.join('')==='確認放置於選定位置')!.props.onClick());
 const output=JSON.stringify(view.toJSON());
 expect(output).not.toContain('預檢可提交');expect(output).toContain('已清除預檢與節點快照');expect(output).toContain('未改選父球、側別或自動放置');expect(parentInput.props.value).toBe('TREE-AX000001');
 expect(command).toHaveBeenCalledTimes(1);act(()=>view.unmount());
});
it('shows node totals separately from the paginated rows',async()=>{
 const view=await render();vi.mocked(get).mockResolvedValue({data:{status:'AVAILABLE',total:101,items:[{qualificationId:'node-1',parentQualificationId:'root',depth:13,side:'LEFT',ownerType:'MEMBER'}],nextCursor:id}});
 const button=view.root.findAllByType('button').find(b=>b.children.join('')==='載入節點')!;await act(async()=>button.props.onClick());
 const output=JSON.stringify(view.toJSON());expect(output).toContain('101');expect(output).toContain('13');expect(output).toContain('下一頁節點');expect(get).toHaveBeenLastCalledWith(expect.stringContaining('/nodes?'));act(()=>view.unmount());
});
it('does not substitute empty statistics when historical evidence is unavailable',async()=>{
 vi.mocked(get).mockResolvedValue({data:{status:'UNAVAILABLE',result:null,explainCode:'OWNER_EVIDENCE_UNAVAILABLE'}});const view=await render(),output=JSON.stringify(view.toJSON());expect(output).toContain('指定時間的樹資料尚未提供');expect(output).not.toContain('OWNER_EVIDENCE_UNAVAILABLE');expect(output).not.toContain('後代球數');act(()=>view.unmount());
});
it('does not infer LEADER from a Company position when the approved profile is unavailable',async()=>{
 const positions=result.positions.map(position=>position.positionNo<=3?{...position,companyProfile:{status:'UNAVAILABLE',planCode:null,profileVersion:null}}:position);
 vi.mocked(get).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,positions}}});
 const view=await render(),output=JSON.stringify(view.toJSON());
 expect(output).toContain('公司持有 · LEADER Profile 證據未提供');expect(output).toContain('公司球 LEADER Profile 證據尚未提供');expect(output).not.toContain('領袖 LEADER');expect(output).not.toContain('公司球 LEADER Profile 已由伺服器核准');
 act(()=>view.unmount());
});
it('shows a Company-held non-bootstrap Ball as Always Active without labelling it LEADER',async()=>{
 const positions=result.positions.map(position=>position.positionNo===4?{
  ...position,ballNo:'TREE-A000004',qualificationId:'member-origin-company-held',ownerType:'COMPANY',activeLabel:'Always Active (Company Rule)',
  companyProfile:{status:'AVAILABLE',planCode:'LEADER',profileVersion:'COMPANY_BOOTSTRAP_PROFILE_V1'}
 }:position);
 vi.mocked(get).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,positions}}});
 const view=await render();
 const fourth=view.root.findAllByType('button').find(button=>String(button.props['aria-label']).includes('創始位置 #4'))!;
 expect(fourth.findAllByType('strong')[0].children.join('')).toContain('公司持有球');
 expect(fourth.findAllByType('div').some(node=>node.children.join('')==='公司持有 · 非 Bootstrap · 保留原 Plan')).toBe(true);
 expect(fourth.findAllByType('span').some(node=>node.children.join('')==='Always Active')).toBe(true);
 expect(String(fourth.props['aria-label'])).toContain('非 Bootstrap，保留原 Plan');
 expect(String(fourth.props['aria-label'])).not.toContain('已核准 LEADER Profile');
 act(()=>view.unmount());
});
it('treats an occupied position without a Ball Number as unavailable rather than AVAILABLE',async()=>{
 role='QUALIFICATION_PLACEMENT_OVERRIDE';
 const positions=result.positions.map(position=>position.positionNo===4?{
  ...position,ballNo:null,qualificationId:'qualification-without-ball-number',ownerType:'MEMBER',activeLabel:null,companyProfile:null
 }:position);
 vi.mocked(get).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,positions}}});
 const view=await render();
 const fourth=view.root.findAllByType('button').find(button=>String(button.props['aria-label']).includes('創始位置 #4'))!;
 expect(fourth.findAllByType('strong')[0].children.join('')).toContain('Member Ball');
 expect(fourth.findAllByType('strong')[0].children.join('')).not.toContain('AVAILABLE');
 expect(String(fourth.props['aria-label'])).toContain('Ball Number 證據未提供');
 expect(view.root.findAllByType('td').some(cell=>cell.children.join('')==='已占用 · Ball Number 證據未提供')).toBe(true);
 await act(async()=>fourth.props.onClick());
 const parentInput=view.root.findAllByType('input').find(input=>input.props.placeholder==='例如 TREE-A000001')!;
 expect(parentInput.props.value).toBe('');
 expect(JSON.stringify(view.toJSON())).toContain('已有資格占用，但 Ball Number 證據未提供，不能作為父球');
 act(()=>view.unmount());
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
 expect(get).toHaveBeenLastCalledWith(originalUrl);expect(JSON.stringify(view.toJSON())).toContain('CURRENT · 最新');act(()=>view.unmount());
});

it('fails closed for unknown tree explain and projection codes',async()=>{
 vi.mocked(get).mockResolvedValueOnce({data:{status:'UNAVAILABLE',result:null,explainCode:'UNRECOGNISED_INTERNAL_REASON'}});
 const unavailable=await render(),unavailableOutput=JSON.stringify(unavailable.toJSON());
 expect(unavailableOutput).toContain('樹資料目前不可用；伺服器未提供可辨識的可用性原因。');
 expect(unavailableOutput).not.toContain('UNRECOGNISED_INTERNAL_REASON');
 act(()=>unavailable.unmount());

 const statistics={required:true,projectionStatus:'UNRECOGNISED_PROJECTION',snapshot:null,dataThrough:null,projectedAt:null,query:{metrics:['founding.statistics']}};
 vi.mocked(get).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,statistics}}});
 const projection=await render(),projectionOutput=JSON.stringify(projection.toJSON());
 expect(projectionOutput).toContain('UNAVAILABLE · 暫不可用');
 expect(projectionOutput).toContain('伺服器未提供可驗證的投影狀態');
 expect(projectionOutput).not.toContain('UNRECOGNISED_PROJECTION');
 act(()=>projection.unmount());
});
it('renders server statistic states and data-through without exposing raw metric reasons or snapshot identifiers',async()=>{
 const dataThrough='2026-09-19T01:00:00.000Z';
 const statuses=['AVAILABLE','PENDING','UNAVAILABLE','STALE','FAILED','AVAILABLE','AVAILABLE'];
 const positions=result.positions.map((position,index)=>{
  const status=statuses[index],available=status==='AVAILABLE';
  return {...position,ballNo:position.ballNo??`TREE-A00000${index+1}`,dataThrough,
   performance:{status,reason:'HISTORICAL_GPV_EVIDENCE_MISSING',value:available?{cumulative:'100.0000',month:'20.0000',leftMonth:'12.0000',rightMonth:'8.0000'}:null},
   carry:{status,reason:'CARRY_SEAL_MISMATCH',value:available?{left:'7.0000',right:'4.0000',pairedPv:'3.0000'}:null}
  };
 });
 const statistics={required:true,projectionStatus:'STALE',snapshot:'internal-snapshot-id',dataThrough,projectedAt:dataThrough,query:{metrics:['founding.statistics']}};
 vi.mocked(get).mockResolvedValueOnce({data:{status:'PARTIAL',result:{...result,positions,statistics}}});
 const view=await render(),output=JSON.stringify(view.toJSON());
 expect(output).toContain('AVAILABLE · 可用');expect(output).toContain('PENDING · 等待建立');expect(output).toContain('UNAVAILABLE · 暫不可用');expect(output).toContain('STALE · 待更新');expect(output).toContain('FAILED · 建立失敗');
 expect(output).toContain('資料截至 '+dataThrough);expect(output).toContain('統計快照已固定');
 expect(output).not.toContain('HISTORICAL_GPV_EVIDENCE_MISSING');expect(output).not.toContain('CARRY_SEAL_MISMATCH');expect(output).not.toContain('internal-snapshot-id');
 act(()=>view.unmount());
});
it('carries the server snapshot token through pagination and child expansion',async()=>{
 const view=await render();
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:101,snapshotToken:'fixed-snapshot',snapshotExpiresAt:'2026-09-19T02:00:00.000Z',time:{asOf:'2026-09-19T01:00:00.000Z',knowledgeCutoff:'2026-09-19T01:00:00.000Z'},nextCursor:'cursor-1',items:[{qualificationId:'parent-node',ballNo:'TREE-A000004',binaryPositionNo:'4',path:'LL',parentQualificationId:null,depth:0,ownerType:'COMPANY'}]}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='載入節點')!.props.onClick());
 expect(JSON.stringify(view.toJSON())).toContain('2026-09-19T02:00:00.000Z');
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:101,snapshotToken:'fixed-snapshot',nextCursor:null,items:[{qualificationId:'last-node',parentQualificationId:'parent-node',depth:1,ownerType:'MEMBER'}]}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='下一頁節點')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('snapshotToken=fixed-snapshot'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('after=cursor-1'));
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:0,snapshotToken:'fixed-snapshot',nextCursor:null,items:[],parentQualificationId:'last-node'}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='展開子節點')!.props.onClick());
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('snapshotToken=fixed-snapshot'));
 expect(get).toHaveBeenLastCalledWith(expect.stringContaining('parentQualificationId=last-node'));act(()=>view.unmount());
});
it('clears the stale node page when snapshot pagination receives 409',async()=>{
 const view=await render();
 vi.mocked(get).mockResolvedValueOnce({data:{status:'AVAILABLE',total:101,snapshotToken:'fixed-snapshot',snapshotExpiresAt:'2026-09-19T02:00:00.000Z',nextCursor:'cursor-1',items:[{qualificationId:'parent-node',ballNo:'TREE-A000004',binaryPositionNo:'4',path:'RLL',parentQualificationId:null,depth:0,ownerType:'MEMBER'}]}});
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='載入節點')!.props.onClick());
 vi.mocked(get).mockRejectedValueOnce(new ApiError(409,null,'snapshot conflict'));
 await act(async()=>view.root.findAllByType('button').find(b=>b.children.join('')==='下一頁節點')!.props.onClick());
 const output=JSON.stringify(view.toJSON());
 expect(output).not.toContain('下一頁節點');expect(output).toContain('已清除預檢與節點快照');expect(output).toContain('重新載入、重新檢視選定位置');
 act(()=>view.unmount());
});

it('suppresses delayed A → B → A tree-detail responses after the latest route context wins',async()=>{
 const requests:Array<{path:string;resolve:(value:unknown|PromiseLike<unknown>)=>void}>=[];
 vi.mocked(get).mockImplementation(((path:string)=>new Promise<unknown>(resolve=>{requests.push({path,resolve});})) as typeof get);
 const view=await renderSwitcher();
 expect(requests).toHaveLength(1);
 const button=(label:string)=>view.root.findAllByType('button').find(node=>node.children.join('')===label)!;
 await act(async()=>{button('切換至 B').props.onClick();await Promise.resolve();});
 await act(async()=>{button('切換至 A').props.onClick();await Promise.resolve();});
 expect(requests).toHaveLength(3);

 await act(async()=>{requests[1].resolve(detail('10000000-0000-4000-8000-000000000002','TREE-B-STALE','樹 B 舊回應'));await Promise.resolve();});
 await act(async()=>{requests[0].resolve(detail(id,'TREE-A-STALE','樹 A 舊回應'));await Promise.resolve();});
 expect(JSON.stringify(view.toJSON())).not.toContain('舊回應');

 await act(async()=>{requests[2].resolve(detail(id,'TREE-A-FRESH','樹 A 最新回應'));await Promise.resolve();});
 const output=JSON.stringify(view.toJSON());
 expect(output).toContain('樹 A 最新回應');expect(output).not.toContain('樹 B 舊回應');expect(output).not.toContain('樹 A 舊回應');
 act(()=>view.unmount());
});

it('suppresses an older concurrent node-page response after a newer node request wins',async()=>{
 const first=deferred(),second=deferred();let nodeRequests=0;
 vi.mocked(get).mockImplementation(((path:string)=>path.includes('/nodes')
  ?(nodeRequests++===0?first.promise:second.promise)
  :Promise.resolve({data:{status:'PARTIAL',result}})) as typeof get);
 const view=await render();
 const load=view.root.findAllByType('button').find(node=>node.children.join('')==='載入節點')!;
 await act(async()=>{load.props.onClick();load.props.onClick();await Promise.resolve();});
 expect(nodeRequests).toBe(2);
 const page=(ballNo:string)=>({data:{status:'AVAILABLE',total:1,nextCursor:null,items:[{qualificationId:ballNo,ballNo,binaryPositionNo:'8',path:'LLL',parentQualificationId:null,side:'LEFT',depth:1,ownerType:'MEMBER',activeLabel:'ACTIVE'}]}});
 await act(async()=>{second.resolve(page('TREE-A-CURRENT'));await Promise.resolve();});
 expect(JSON.stringify(view.toJSON())).toContain('TREE-A-CURRENT');
 await act(async()=>{first.resolve(page('TREE-A-STALE'));await Promise.resolve();});
 const output=JSON.stringify(view.toJSON());
 expect(output).toContain('TREE-A-CURRENT');expect(output).not.toContain('TREE-A-STALE');
 act(()=>view.unmount());
});
