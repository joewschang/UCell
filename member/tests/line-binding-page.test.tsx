import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({requestLineBinding:vi.fn(),completeLineBinding:vi.fn()}));
vi.mock('../src/lineBinding',()=>api);
import {LineBinding} from '../src/LineBindingPage';
it('retains the request key across failure, waits for approval, and enters only on successful completion',async()=>{
 const done=vi.fn();const tree=create(<LineBinding onComplete={done} onRecheck={()=>{}}/>);
 const inputs=tree.root.findAllByType('input');
 act(()=>{inputs[0].props.onChange({target:{value:'2609250001'}});inputs[1].props.onChange({target:{value:'CASE-001'}});});
 api.requestLineBinding.mockRejectedValueOnce(new Error('retry')).mockResolvedValueOnce('request');
 await act(async()=>tree.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
 await act(async()=>tree.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
 expect(api.requestLineBinding.mock.calls[0]).toEqual(api.requestLineBinding.mock.calls[1]);expect(done).not.toHaveBeenCalled();
 expect(tree.root.findAllByType('input')[2].props.value).toBe('request');
 act(()=>tree.root.findAllByType('input')[3].props.onChange({target:{value:'approved-proof'}}));
 api.completeLineBinding.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
 await act(async()=>tree.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}}));expect(done).not.toHaveBeenCalled();
 await act(async()=>tree.root.findAllByType('form')[1].props.onSubmit({preventDefault(){}}));expect(done).toHaveBeenCalledOnce();
 expect(tree.root.findAllByType('input')[3].props.value).toBe('');act(()=>tree.unmount());
});

it('rechecks through bootstrap after response loss without consuming the proof again',()=>{
 const done=vi.fn(),recheck=vi.fn(),tree=create(<LineBinding onComplete={done} onRecheck={recheck}/>);
 const requestCalls=api.requestLineBinding.mock.calls.length,completionCalls=api.completeLineBinding.mock.calls.length;
 act(()=>tree.root.findAllByType('button').find(button=>button.children.includes('重新檢查綁定狀態'))!.props.onClick());
 expect(recheck).toHaveBeenCalledOnce();expect(done).not.toHaveBeenCalled();expect(api.requestLineBinding.mock.calls).toHaveLength(requestCalls);expect(api.completeLineBinding.mock.calls).toHaveLength(completionCalls);act(()=>tree.unmount());
});
