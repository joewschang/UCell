import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import {ApplicationsPage} from './ApplicationsPage';
const f=vi.hoisted(()=>({command:vi.fn(async()=>({})),invalidate:vi.fn(async()=>{}),detail:{status:'SUBMITTED',sourceChannel:'MEMBER_WEB',applicantType:'INDIVIDUAL',payload:{sponsorBallNo:'A000001',phone:'0900000000',email:'test@example.invalid',bankCode:'TEST',bankAccount:'SYNTHETIC1234',accountHolder:'TEST HOLDER',communicationAddress:'TEST ADDRESS',birthDate:'1990-01-01'},paperEvidence:[],person:{memberNo:'TEST-MEMBER'},feeOrder:{orderId:'TEST-ORDER',status:'CONFIRMED'},crossLineReviewStatus:'CLEAR'}}));
vi.mock('../../lib/api',()=>({command:f.command,get:vi.fn(),getBlob:vi.fn(),qs:()=>''}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:f.invalidate}),useQuery:({queryKey}:any)=>({data:{data:queryKey[0]==='formal-applications'?[{id:'TEST-APP',memberNo:'TEST-MEMBER',personNameMasked:'T*'}]:queryKey[0]==='formal-application-detail'?f.detail:[]}})}));
vi.mock('../../components/ConfirmAction',()=>({ConfirmAction:({children,onConfirm,disabled}:any)=><button disabled={disabled} onClick={()=>onConfirm('已核對正本與申請資料')}>{children}</button>}));
let tree:ReactTestRenderer;
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.clearAllMocks()});
it('records cash first and then reviews and approves from the same page',async()=>{
 await act(async()=>{tree=create(<MemoryRouter><ApplicationsPage/></MemoryRouter>)});
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('TEST-MEMBER'))!.props.onClick());
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('確認收款 600 元並核准'))!.props.onClick());
 expect(f.command.mock.calls.map((x:any)=>x[0])).toEqual(['/admin/orders/TEST-ORDER/payment-confirmations','/admin/formal-member-applications/TEST-APP/begin-review','/admin/formal-member-applications/TEST-APP/approve']);
 expect((f.command.mock.calls[0] as any)[1]).toMatchObject({amount:'600.00',paymentMethod:'CASH',referenceNo:''});
});
it('keeps refresh and does not approve after a review failure following cash collection',async()=>{
 f.command.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('DOCUMENTS_REQUIRED'));
 await act(async()=>{tree=create(<MemoryRouter><ApplicationsPage/></MemoryRouter>)});
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('TEST-MEMBER'))!.props.onClick());
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('確認收款 600 元並核准'))!.props.onClick());
 expect(f.command).toHaveBeenCalledTimes(2);expect(f.invalidate).toHaveBeenCalled();
});

it('shows sponsor, identity, contact and bank fields for reviewer comparison',async()=>{
 await act(async()=>{tree=create(<MemoryRouter><ApplicationsPage/></MemoryRouter>)});
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('TEST-MEMBER'))!.props.onClick());
 const text=JSON.stringify(tree.toJSON());for(const value of ['A000001','test@example.invalid','SYNTHETIC1234','TEST ADDRESS','1990-01-01','證件與存摺照片核對'])expect(text).toContain(value);
});

it('sends the physical review note to persistent evidence endpoint',async()=>{
 await act(async()=>{tree=create(<MemoryRouter><ApplicationsPage/></MemoryRouter>)});
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('TEST-MEMBER'))!.props.onClick());
 await act(async()=>tree.root.findAllByType('button').find(x=>x.children.join('')==='已現場核對存摺封面正本')!.props.onClick());
 expect(f.command).toHaveBeenCalledWith('/admin/formal-member-applications/TEST-APP/paper-evidence',{evidenceType:'BANKBOOK_COVER',decision:'REVIEWED',note:'已核對正本與申請資料'});
});

it('routes pending package collection to the package order and hides duplicate 600 collection',async()=>{
 (f.detail as any).packageOrders=[{orderId:'PACKAGE-ORDER',packageName:'啟航套組',amount:'14400',status:'CONFIRMED'}];
 try{await act(async()=>{tree=create(<MemoryRouter><ApplicationsPage/></MemoryRouter>)});await act(async()=>tree.root.findAllByType('button').find(x=>x.children.includes('TEST-MEMBER'))!.props.onClick());
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('14,400');expect(text).toContain('/orders?orderId=PACKAGE-ORDER');expect(text).not.toContain('確認現金收款 600 元');expect(text).not.toContain('確認收款 600 元並核准');
 }finally{delete (f.detail as any).packageOrders;}
});
