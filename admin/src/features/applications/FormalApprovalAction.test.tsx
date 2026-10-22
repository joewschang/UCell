import React from 'react';
import {act,create} from 'react-test-renderer';
import {afterEach,it,expect,vi} from 'vitest';
import {FormalApprovalAction,approvalErrorMessage} from './FormalApprovalAction';
import {ApiError,command,get} from '../../lib/api';
vi.mock('../../lib/api',async original=>({...await original<any>(),command:vi.fn(),get:vi.fn()}));
vi.mock('../../components/ConfirmAction',()=>({ConfirmAction:({children,onConfirm,disabled}:any)=><button disabled={disabled} onClick={onConfirm}>{children}</button>}));
afterEach(()=>vi.clearAllMocks());
async function setup(status='UNDER_REVIEW'){
 let tree:any;const onApproved=vi.fn(),onBusy=vi.fn();await act(async()=>{tree=create(<FormalApprovalAction applicationId="app" status={status} disabled={false} onApproved={onApproved} onBusy={onBusy}/>)});return {tree,onApproved,onBusy};
}
it('shows pending, coalesces duplicate clicks and permanently changes to approved on success',async()=>{
 let resolve:any;vi.mocked(command).mockImplementation(()=>new Promise(r=>resolve=r));const {tree,onApproved}=await setup();
 let pending:any;await act(async()=>{pending=tree.root.findByType('button').props.onClick();});
 expect(tree.root.findByType('button').props.disabled).toBe(true);expect(JSON.stringify(tree.toJSON())).toContain('核准中');
 await act(async()=>tree.root.findByType('button').props.onClick());expect(command).toHaveBeenCalledOnce();
 await act(async()=>{resolve({data:{status:'APPROVED'}});await pending;});
 expect(onApproved).toHaveBeenCalledOnce();expect(tree.root.findByType('button').children.join('')).toBe('已核准正式會員');expect(tree.root.findByType('button').props.disabled).toBe(true);act(()=>tree.unmount());
});
it('shows a business failure beside the button and permits a corrected retry',async()=>{
 vi.mocked(command).mockRejectedValueOnce(new ApiError(422,{code:'FORMAL_ENROLLMENT_PAYMENT_REQUIRED'},'invalid'));const {tree,onApproved}=await setup();
 await act(async()=>tree.root.findByType('button').props.onClick());expect(tree.root.findByProps({role:'alert'}).children.join('')).toContain('尚未確認付款');expect(onApproved).not.toHaveBeenCalled();expect(tree.root.findByType('button').children.join('')).toBe('重新核准正式會員');act(()=>tree.unmount());
});
it('queries an uncertain outcome without posting twice and recognizes an approval that completed',async()=>{
 vi.mocked(command).mockRejectedValueOnce(new ApiError(0,null,'timeout'));vi.mocked(get).mockResolvedValueOnce({data:{status:'APPROVED'}});const {tree,onApproved}=await setup();
 await act(async()=>tree.root.findByType('button').props.onClick());expect(tree.root.findByType('button').children.join('')).toBe('查詢核准結果');
 await act(async()=>tree.root.findByType('button').props.onClick());expect(command).toHaveBeenCalledOnce();expect(onApproved).toHaveBeenCalledOnce();expect(tree.root.findByType('button').children.join('')).toBe('已核准正式會員');act(()=>tree.unmount());
});
it('renders persisted approvals as completed without sending a request',async()=>{
 const {tree}=await setup('APPROVED');expect(tree.root.findByType('button').props.disabled).toBe(true);expect(JSON.stringify(tree.toJSON())).toContain('已核准正式會員');expect(command).not.toHaveBeenCalled();act(()=>tree.unmount());
});
it('uses only known safe error codes rather than exposing arbitrary server details',()=>{
 expect(approvalErrorMessage(new ApiError(422,{code:'FORMAL_APPROVAL_GATE_BLOCKED',details:{codes:['SPOUSE_VERIFICATION_REQUIRED','IDENTITY_BACK_MISSING','secret-value']}},'invalid'))).toBe('請先完成配偶資料核驗。 尚缺身分證明文件反面。');
});
