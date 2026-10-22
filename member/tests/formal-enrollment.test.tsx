import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import FormalEnrollment from '../src/FormalEnrollment';
import {submitFormalEnrollment} from '../src/memberData';
const fixture=vi.hoisted(()=>({state:{membershipState:'NETWORK_MEMBER',feeAmount:'600.00',currency:'TWD',stagePaymentEnabled:false,feeReceipt:null as any,application:null as any,paidPackages:[] as any[],pendingPackages:[] as any[]},retry:vi.fn()}));
vi.mock('../src/useResource',()=>({useResource:()=>({data:fixture.state,retry:fixture.retry})}));
vi.mock('../src/memberData',()=>({getFormalEnrollment:vi.fn(),submitFormalEnrollment:vi.fn(async()=>({}))}));
vi.mock('../src/FormalUpgrade',()=>({default:({onSaved}:any)=> <button onClick={()=>onSaved('APP')}>儲存測試資料</button>}));
vi.mock('../src/MembershipSignature',()=>({default:({onReady}:any)=>{React.useEffect(()=>onReady(true),[onReady]);return <p>會員簽名已保存</p>;}}));
vi.mock('../src/QualificationPackageShop',()=>({default:()=> <p>資格套組選擇</p>}));
let tree:ReactTestRenderer;
afterEach(()=>{act(()=>tree?.unmount());vi.clearAllMocks();fixture.state.application=null;fixture.state.paidPackages=[];fixture.state.pendingPackages=[];});
const render=async()=>{await act(async()=>{tree=create(<MemoryRouter><FormalEnrollment/></MemoryRouter>)});};
const button=(text:string)=>tree.root.findAllByType('button').find(b=>b.children.includes(text))!;
it('requires saved data before package selection and has no fee-only membership route',async()=>{
 await render();expect(button('資格套組').props.disabled).toBe(true);expect(button('送出審核').props.disabled).toBe(true);
 await act(async()=>button('儲存測試資料').props.onClick());expect(button('資格套組').props.disabled).toBe(false);expect(JSON.stringify(tree.toJSON())).toContain('選擇會員資格套組');
 await act(async()=>button('資格套組').props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('每資格 600 元');expect(JSON.stringify(tree.toJSON())).not.toContain('繳交 600 元並開始申請');
});
it('keeps unpaid packages pending and submits paid applications once with explicit review',async()=>{
 fixture.state.application={id:'APP',status:'DRAFT'};fixture.state.pendingPackages=[{orderId:'ORDER',packageName:'啟航',total:'600',goodsAmount:'0',qualificationFee:'600',selectableProductQuantity:0,couponCode:'UCELL888',paymentDeadline:'2027-01-31T16:00:00Z'}];await render();
 await act(async()=>button('付款確認').props.onClick());expect(JSON.stringify(tree.toJSON())).toContain('UCELL888');expect(button('送出審核').props.disabled).toBe(true);
 act(()=>tree.unmount());fixture.state.paidPackages=[{orderId:'ORDER',packageName:'啟航'}];await render();await act(async()=>button('送出審核').props.onClick());await act(async()=>button('確認送出正式會員申請').props.onClick());expect(submitFormalEnrollment).toHaveBeenCalledOnce();expect(JSON.stringify(tree.toJSON())).toContain('各資格須符合活躍');
});
it('allows bank transfer intent to advance and submit while payment stays pending',async()=>{
 fixture.state.application={id:'APP',status:'DRAFT'};fixture.state.pendingPackages=[{orderId:'ORDER',packageName:'啟航',total:'15000',goodsAmount:'14400',qualificationFee:'600',selectableProductQuantity:3,paymentDeadline:'2099-01-01'}];await render();
 await act(async()=>tree.root.findByType('select').props.onChange({target:{value:'BANK_TRANSFER'}}));
 await act(async()=>button('繼續下一步：送出審核 →').props.onClick());
 expect(JSON.stringify(tree.toJSON())).toContain('銀行匯款／待收款確認');
 await act(async()=>button('確認送出正式會員申請').props.onClick());
 expect(submitFormalEnrollment).toHaveBeenCalledWith('APP',expect.any(String),{orderId:'ORDER',paymentMethod:'BANK_TRANSFER'});
});
it('shows correction instructions and starts on the editable profile even when a package exists',async()=>{fixture.state.application={id:'APP',status:'NEEDS_MORE_INFO',reviewNote:'請補傳清晰的存摺封面'};fixture.state.paidPackages=[{orderId:'ORDER',packageName:'啟航'}];await render();expect(JSON.stringify(tree.toJSON())).toContain('請補傳清晰的存摺封面');expect(tree.root.findAllByType('li').find(x=>x.props['aria-current']==='step')?.findByType('button').children).toContain('會員資料');});
