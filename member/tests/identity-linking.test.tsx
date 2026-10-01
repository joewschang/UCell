import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';

const auth=vi.hoisted(()=>({linkGoogleIdentity:vi.fn(),renderGoogleRegistrationButton:vi.fn()}));
vi.mock('../src/webAuth',()=>auth);
import IdentityLinking from '../src/IdentityLinking';

let tree:ReactTestRenderer|undefined;
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.clearAllMocks();});

it('links Google to the current authenticated member instead of creating another account',async()=>{
 let submit:(token:string)=>void=()=>{};
 auth.renderGoogleRegistrationButton.mockImplementation(async(_el:any,onCredential:(token:string)=>void)=>{submit=onCredential;});
 auth.linkGoogleIdentity.mockResolvedValue({provider:'GOOGLE',linked:true});
 await act(async()=>{tree=create(<IdentityLinking/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 await act(async()=>{await Promise.resolve();});
 expect(auth.renderGoogleRegistrationButton).toHaveBeenCalled();
 await act(async()=>submit('GOOGLE_LINK_TOKEN'));
 expect(auth.linkGoogleIdentity).toHaveBeenCalledWith('GOOGLE_LINK_TOKEN');
 const text=JSON.stringify(tree!.toJSON());
 expect(text).toContain('Google 帳號已連結');
 expect(text).toContain('不會建立新會員、球或新的會員編號');
});

it('shows a linking error without changing the member session',async()=>{
 let submit:(token:string)=>void=()=>{};
 auth.renderGoogleRegistrationButton.mockImplementation(async(_el:any,onCredential:(token:string)=>void)=>{submit=onCredential;});
 auth.linkGoogleIdentity.mockRejectedValue(new Error('GOOGLE_IDENTITY_ALREADY_LINKED'));
 await act(async()=>{tree=create(<IdentityLinking/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 await act(async()=>{await Promise.resolve();});
 expect(auth.renderGoogleRegistrationButton).toHaveBeenCalled();
 await act(async()=>submit('CONFLICT_TOKEN'));
 expect(JSON.stringify(tree!.toJSON())).toContain('GOOGLE_IDENTITY_ALREADY_LINKED');
});
