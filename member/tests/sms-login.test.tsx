import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
const auth=vi.hoisted(()=>({smsLoginPolicy:vi.fn(),smsLoginRequest:vi.fn(),smsLogin:vi.fn()}));
vi.mock('../src/webAuth',()=>auth);
import SmsLogin from '../src/SmsLogin';
let tree:ReactTestRenderer;
afterEach(()=>{if(tree)act(()=>tree.unmount());vi.clearAllMocks();});
it('requests a code, prevents immediate resend and authenticates only after verification',async()=>{
 auth.smsLoginPolicy.mockResolvedValue({enabled:true});
 auth.smsLoginRequest.mockResolvedValue({challengeId:'challenge',resendAt:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+300000).toISOString()});
 const done=vi.fn();await act(async()=>{tree=create(<SmsLogin onAuthenticated={done}/>)});
 act(()=>tree.root.findByType('input').props.onChange({target:{value:'0912345678'}}));
 await act(async()=>tree.root.findByType('button').props.onClick());
 expect(auth.smsLoginRequest).toHaveBeenCalledWith('0912345678',expect.any(String));
 expect(tree.root.findAllByType('button')[0].props.disabled).toBe(true);expect(done).not.toHaveBeenCalled();
 act(()=>tree.root.findAllByType('input')[1].props.onChange({target:{value:'123456'}}));
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.smsLogin).toHaveBeenCalledWith('0912345678','challenge','123456');expect(done).toHaveBeenCalledOnce();
 act(()=>tree.root.findAllByType('input')[0].props.onChange({target:{value:'0987654321'}}));
 expect(tree.root.findAllByType('input')).toHaveLength(1);
});
it('does not expose login controls when policy cannot be loaded',async()=>{
 auth.smsLoginPolicy.mockRejectedValue(Error('offline'));
 await act(async()=>{tree=create(<SmsLogin onAuthenticated={vi.fn()}/>)});
 expect(tree.root.findAllByType('input')).toHaveLength(0);
});
