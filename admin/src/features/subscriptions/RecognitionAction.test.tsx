import React from 'react';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {RecognitionAction} from './RecognitionAction';
const mocks=vi.hoisted(()=>({role:'SUPER_ADMIN',command:vi.fn(),invalidateQueries:vi.fn()}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:mocks.role}})}));
vi.mock('../../lib/api',()=>({command:mocks.command}));
vi.mock('@tanstack/react-query',()=>({useQueryClient:()=>({invalidateQueries:mocks.invalidateQueries})}));
vi.mock('../../components/ConfirmAction',()=>({ConfirmAction:({onConfirm,disabled,children}:any)=><button disabled={disabled} onClick={onConfirm}>{children}</button>}));
const schedule={recognitionId:'11111111-1111-4111-8111-111111111111',status:'DUE',dueAt:'2020-01-01T00:00:00Z'};
function render(overrides={}){let view:any;act(()=>{view=create(<RecognitionAction schedule={{...schedule,...overrides}} subscriptionId="sub-1" loading={false}/>)});return view;}
beforeEach(()=>{mocks.role='SUPER_ADMIN';mocks.command.mockReset().mockResolvedValue({data:{}});mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);});
it.each(['COMPLIANCE_AUDIT','SUPPORT',''])('hides mutations from %s',role=>{mocks.role=role;const v=render();expect(v.root.findAllByType('button')).toHaveLength(0);act(()=>v.unmount());});
it.each([{status:'RECOGNIZED'},{status:'CANCELLED'},{dueAt:'2999-01-01T00:00:00Z'},{dueAt:'invalid'}])('blocks ineligible schedule %j',overrides=>{const v=render(overrides);expect(v.root.findByType('button').props.disabled).toBe(true);act(()=>v.unmount());});
it('coalesces clicks and refreshes detail and list after recognition',async()=>{
 let resolve!:()=>void;mocks.command.mockImplementation(()=>new Promise<{data:{}}>(r=>resolve=()=>r({data:{}})));const v=render();
 let run!:Promise<void>;act(()=>{run=v.root.findByType('button').props.onClick();v.root.findByType('button').props.onClick();});
 expect(mocks.command).toHaveBeenCalledTimes(1);expect(mocks.command).toHaveBeenCalledWith(`/admin/rpv/recognitions/${schedule.recognitionId}/run`);
 await act(async()=>{resolve();await run;});expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);expect(JSON.stringify(v.toJSON())).toContain('認列已完成');expect(v.root.findAllByType('button')[0].props.disabled).toBe(true);act(()=>v.unmount());
});
it('requires a successful status check after failure before manual retry',async()=>{
 mocks.command.mockRejectedValue(Error('無法確認認列結果'));const v=render();await act(async()=>v.root.findByType('button').props.onClick());
 expect(JSON.stringify(v.toJSON())).toContain('無法確認認列結果');expect(v.root.findAllByType('button')[0].props.disabled).toBe(true);
 mocks.invalidateQueries.mockRejectedValue(Error('offline'));await act(async()=>v.root.findAllByType('button')[1].props.onClick());expect(v.root.findAllByType('button')[0].props.disabled).toBe(true);
 mocks.invalidateQueries.mockResolvedValue(undefined);await act(async()=>v.root.findAllByType('button')[1].props.onClick());expect(v.root.findAllByType('button')[0].props.disabled).toBe(false);act(()=>v.unmount());
});
it('shows persisted isolation evidence to audit readers without write controls',()=>{
 mocks.role='COMPLIANCE_AUDIT';const v=render({workerBlocked:true,workerFailureCount:5,workerLastErrorCode:'RECOGNITION_TRANSACTION_CONFLICT',workerLastTraceId:'trace-1'});
 expect(JSON.stringify(v.toJSON())).toContain('已暫停自動處理');expect(JSON.stringify(v.toJSON())).toContain('trace-1');expect(v.root.findAllByType('button')).toHaveLength(0);act(()=>v.unmount());
});
it('does not label a skipped API command as completed recognition',async()=>{
 mocks.command.mockResolvedValue({data:{skipped:'NOT_DUE'}});const v=render();await act(async()=>v.root.findByType('button').props.onClick());expect(JSON.stringify(v.toJSON())).toContain('本次未執行認列');expect(JSON.stringify(v.toJSON())).not.toContain('認列已完成');act(()=>v.unmount());
});
