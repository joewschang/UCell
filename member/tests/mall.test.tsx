import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {afterEach,it,expect,vi} from 'vitest';
import Mall,{mallCategories} from '../src/Mall';
const fixture=vi.hoisted(()=>({membershipState:'NETWORK_MEMBER'}));
vi.mock('../src/memberData',()=>({getFormalEnrollment:vi.fn(async()=>({membershipState:fixture.membershipState})),getCommercialOffers:vi.fn(),getProducts:vi.fn(),getDeliveryProfile:vi.fn()}));
vi.mock('../src/useResource',()=>({useResource:()=>({data:[],retry:vi.fn()})}));
vi.mock('../src/QualificationPackageShop',()=>({default:({onCreated}:{onCreated:()=>void})=><button onClick={onCreated}>完成套組商品選擇</button>}));
vi.mock('../src/ActiveDurationPackages',()=>({default:()=> <p>重購方案選擇</p>}));
let tree:ReactTestRenderer;
afterEach(()=>{act(()=>tree?.unmount());fixture.membershipState='NETWORK_MEMBER';});
function Location(){return <output>{useLocation().pathname}</output>;}
it.each(['NETWORK_MEMBER','FORMAL_PENDING'])('redirects %s after package selection to the formal application',async state=>{
 fixture.membershipState=state;
 await act(async()=>{tree=create(<MemoryRouter initialEntries={['/shop']}><Mall onCreated={vi.fn()}/><Location/></MemoryRouter>)});
 for(const category of mallCategories)expect(JSON.stringify(tree.toJSON())).toContain(category);
 await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('完成套組商品選擇'))!.props.onClick());
 expect(tree.root.findByType('output').children).toEqual(['/membership/upgrade']);
});
it('keeps formal members in the mall and explains the qualification requirement for repurchase',async()=>{
 fixture.membershipState='FORMAL_MEMBER';const refresh=vi.fn();
 await act(async()=>{tree=create(<MemoryRouter initialEntries={['/shop']}><Mall onCreated={refresh}/><Location/></MemoryRouter>)});
 await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('完成套組商品選擇'))!.props.onClick());expect(refresh).toHaveBeenCalledOnce();expect(tree.root.findByType('output').children).toEqual(['/shop']);
 await act(async()=>tree.root.findAllByType('button').find(b=>b.children.includes('重購方案套組'))!.props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('需指定本人會員資格');
});
