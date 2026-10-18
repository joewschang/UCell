import React from 'react';
import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {MembershipProgressView} from '../src/MembershipProgress';
const base={membershipState:'FORMAL_PENDING',feeAmount:'600',paidPackages:[],feeReceipt:null,application:{id:'APP',status:'SUBMITTED'},packageOrders:[{orderId:'ORDER',packageName:'啟航',amount:'14400',status:'CONFIRMED'}]};
function view(state:any){let tree:any;act(()=>{tree=create(<MemoryRouter><MembershipProgressView state={state} refresh={vi.fn()}/></MemoryRouter>)});const text=JSON.stringify(tree.toJSON());act(()=>tree.unmount());return text;}
it('labels unpaid package as an order, not acquired qualification',()=>{const text=view(base);expect(text).toContain('尚未取得經營資格');expect(text).toContain('待收款確認');expect(text).toContain('已送出，待審核');});
it('keeps paid applicant pending review',()=>{expect(view({...base,paidPackages:[{}],packageOrders:[{...base.packageOrders[0],status:'PAID'}]})).toContain('付款已確認，仍須通過正式會員審核');});
it('removes application action for approved formal member',()=>{const text=view({...base,membershipState:'FORMAL_MEMBER',application:{status:'APPROVED'},packageOrders:[]});expect(text).toContain('正式會員服務');expect(text).not.toContain('/membership/upgrade');expect(text).not.toContain('開始正式會員申請');});
it('shows separate supplement action with reviewer instructions',()=>{const text=view({...base,application:{status:'NEEDS_MORE_INFO',reviewNote:'補清晰存摺'}});expect(text).toContain('會員補件中心');expect(text).toContain('前往補件');expect(text).toContain('補清晰存摺');});
