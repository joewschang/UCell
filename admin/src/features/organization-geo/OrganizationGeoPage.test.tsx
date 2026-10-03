import React from 'react';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {OrganizationGeoPage} from './OrganizationGeoPage';
const auth=vi.hoisted(()=>({role:'ORG_GEO_VIEW'}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:auth.role,provider:'ENTRA'}})}));
vi.mock('../../lib/api',()=>({get:vi.fn(),adminToken:()=>null,ApiError:class extends Error{},qs:(v:Record<string,string>)=>'?'+new URLSearchParams(v)}));
beforeEach(()=>{vi.mocked(get).mockReset();auth.role='ORG_GEO_VIEW';});
const measure={balls:2,members:1,activeBalls:0,activeRate:null,newBalls:1,gpv:null,unknownActiveBalls:2};
const response={data:{status:'PARTIAL',reason:null,rootBallNo:'A000001',time:{asOf:'2026-10-01T00:00:00.000Z'},summary:{...measure,descendantBalls:2,uniqueMembers:1,unlocatedBalls:0},distribution:[{...measure,areaCode:'63000',areaName:'臺北市'}],branchComparison:[],carry:null}};
async function render(){let tree:ReturnType<typeof create>;await act(async()=>{tree=create(<OrganizationGeoPage/>);});return tree!;}
async function search(tree:ReturnType<typeof create>){await act(async()=>{tree.root.findAllByType('input')[0].props.onChange({target:{value:'A000001'}});});await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});}
it('keeps unavailable GPV out of rankings and hides drill/export controls for view-only roles',async()=>{
 vi.mocked(get).mockResolvedValue(response);const tree=await render();await search(tree);
 await act(async()=>tree.root.findAllByType('select')[2].props.onChange({target:{value:'gpv'}}));
 const output=JSON.stringify(tree.toJSON());expect(output).toContain('所選指標尚無足夠證據');expect(output).not.toContain('匯出目前明細');
 expect(tree.root.findAllByType('path').every(path=>path.props.tabIndex===undefined)).toBe(true);tree.unmount();
});
it('discards an in-flight response when the root filter changes',async()=>{
 let resolve:(value:typeof response)=>void=()=>{};vi.mocked(get).mockReturnValue(new Promise(r=>{resolve=r;}));
 const tree=await render();await act(async()=>tree.root.findAllByType('input')[0].props.onChange({target:{value:'A000001'}}));
 let pending:Promise<void>;act(()=>{pending=tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
 await act(async()=>tree.root.findAllByType('input')[0].props.onChange({target:{value:'A000002'}}));
 await act(async()=>{resolve(response);await pending!;});expect(JSON.stringify(tree.toJSON())).not.toContain('球號 A000001');tree.unmount();
});
