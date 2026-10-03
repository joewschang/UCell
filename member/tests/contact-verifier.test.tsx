import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
const request=vi.hoisted(()=>vi.fn());
vi.mock('../src/webAuth',()=>({contactVerificationRequest:request}));
import ContactVerifier from '../src/ContactVerifier';
let tree:ReactTestRenderer|undefined;
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;request.mockReset();vi.useRealTimers();});
const challenge=()=>({challengeId:'11111111-1111-4111-8111-111111111111',status:'SENT',expiresAt:new Date(Date.now()+300000).toISOString(),resendAt:new Date(Date.now()+60000).toISOString()});
it('requires the delivered code, binds registration identity and clears verification when contact changes',async()=>{
 const verified=vi.fn();request.mockResolvedValueOnce(challenge()).mockResolvedValueOnce({proof:'a'.repeat(64)});
 await act(async()=>{tree=create(<ContactVerifier channel="SMS" value="0912345678" purpose="REGISTRATION" onVerified={verified} registrationTokens={()=>({lineIdToken:'TEST_LINE_PROOF'})}/>);});
 await act(async()=>tree!.root.findByType('button').props.onClick());
 expect(request.mock.calls[0][1]).toMatchObject({channel:'SMS',destination:'0912345678',lineIdToken:'TEST_LINE_PROOF'});
 expect(verified).not.toHaveBeenCalledWith('a'.repeat(64));
 act(()=>tree!.root.findByType('input').props.onChange({target:{value:'123456'}}));
 await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.join('')==='確認手機驗證碼')!.props.onClick());
 expect(verified).toHaveBeenLastCalledWith('a'.repeat(64));
 await act(async()=>tree!.update(<ContactVerifier channel="SMS" value="0987654321" purpose="REGISTRATION" onVerified={verified} registrationTokens={()=>({lineIdToken:'TEST_LINE_PROOF'})}/>));
 expect(verified).toHaveBeenLastCalledWith(undefined);expect(JSON.stringify(tree!.toJSON())).not.toContain('手機已驗證');
});
it('does not report success while delivery service is unavailable',async()=>{
 request.mockRejectedValueOnce(new Error('手機簡訊驗證尚未開通，請稍後再試。'));const verified=vi.fn();
 await act(async()=>{tree=create(<ContactVerifier channel="SMS" value="0912345678" purpose="PROFILE" onVerified={verified}/>);});
 await act(async()=>tree!.root.findByType('button').props.onClick());
 expect(JSON.stringify(tree!.toJSON())).toContain('尚未開通');expect(verified).not.toHaveBeenCalledWith(expect.any(String));
});
it('invalidates proof on expiry and shows a recoverable error',async()=>{
 vi.useFakeTimers();request.mockResolvedValueOnce(challenge()).mockResolvedValueOnce({proof:'b'.repeat(64)});const verified=vi.fn();
 await act(async()=>{tree=create(<ContactVerifier channel="EMAIL" value="test@example.invalid" purpose="PROFILE" onVerified={verified}/>);});
 await act(async()=>tree!.root.findByType('button').props.onClick());act(()=>tree!.root.findByType('input').props.onChange({target:{value:'123456'}}));
 await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.join('')==='確認Email驗證碼')!.props.onClick());
 await act(async()=>{vi.advanceTimersByTime(301000)});
 expect(verified).toHaveBeenLastCalledWith(undefined);expect(JSON.stringify(tree!.toJSON())).toContain('驗證已過期');
});
