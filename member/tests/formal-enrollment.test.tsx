import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import FormalEnrollment from '../src/FormalEnrollment';
import {payFormalEnrollmentFee} from '../src/memberData';
const fixture=vi.hoisted(()=>({state:{membershipState:'NETWORK_MEMBER',feeAmount:'600.00',currency:'TWD',stagePaymentEnabled:true,feeReceipt:null as any,application:null,paidPackages:[] as any[]},retry:vi.fn()}));
vi.mock('../src/useResource',()=>({useResource:()=>({data:fixture.state,retry:fixture.retry})}));
vi.mock('../src/memberData',()=>({getFormalEnrollment:vi.fn(),payFormalEnrollmentFee:vi.fn(async()=>({}))}));
vi.mock('../src/FormalUpgrade',()=>({default:()=> <p>正式會員資料表</p>}));
vi.mock('../src/QualificationPackageShop',()=>({default:()=> <p>資格套組選擇</p>}));
let tree:ReactTestRenderer|undefined;
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.clearAllMocks();fixture.state.stagePaymentEnabled=true;fixture.state.feeReceipt=null;fixture.state.paidPackages=[];});
const render=async()=>{await act(async()=>{tree=create(<MemoryRouter><FormalEnrollment/></MemoryRouter>)});};
it('offers both routes, submits the fixed fee endpoint and retains explicit Stage/review wording',async()=>{
 await render();expect(JSON.stringify(tree!.toJSON())).toContain('方式一：選購會員資格套組');
 const pay=tree!.root.findAllByType('button').find(n=>n.children.includes('繳交 600 元並開始申請'))!;
 await act(async()=>pay.props.onClick());expect(payFormalEnrollmentFee).toHaveBeenCalledOnce();expect(fixture.retry).toHaveBeenCalledOnce();
 expect(JSON.stringify(tree!.toJSON())).toContain('不會扣款');expect(JSON.stringify(tree!.toJSON())).toContain('審核');
});
it('does not offer a second fee after package payment and does not enable simulated Production payment',async()=>{
 fixture.state.paidPackages=[{orderId:'TEST',packageName:'TEST ONLY PACKAGE'}];await render();
 expect(JSON.stringify(tree!.toJSON())).toContain('不需另繳 600 元');expect(tree!.root.findAllByType('button').some(n=>n.children.includes('繳交 600 元並開始申請'))).toBe(false);
 act(()=>tree!.unmount());tree=undefined;fixture.state.paidPackages=[];fixture.state.stagePaymentEnabled=false;await render();
 expect(tree!.root.findAllByType('button').find(n=>n.children.includes('繳交 600 元並開始申請'))!.props.disabled).toBe(true);
});
