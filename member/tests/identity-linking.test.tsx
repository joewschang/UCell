import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';

const auth=vi.hoisted(()=>({linkGoogleIdentity:vi.fn(),renderGoogleRegistrationButton:vi.fn(),linkLineIdentity:vi.fn(),loginMethods:vi.fn(async()=>({google:true,line:false}))}));
const line=vi.hoisted(()=>({prepareLineIdentityLink:vi.fn()}));
vi.mock('../src/lineBinding',()=>line);
vi.mock('../src/webAuth',()=>auth);
import IdentityLinking from '../src/IdentityLinking';

let tree:ReactTestRenderer|undefined;
it('recovers login method controls after a transient status failure',async()=>{
 auth.loginMethods.mockRejectedValueOnce(new Error('NETWORK_FAILED'));
 await act(async()=>{tree=create(<IdentityLinking/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 expect(JSON.stringify(tree!.toJSON())).toContain('無法讀取登入方式');
 await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.includes('重新載入登入方式'))!.props.onClick());
 expect(JSON.stringify(tree!.toJSON())).toContain('Google：');
 expect(tree!.root.findAllByType('button').find(b=>b.children.includes('驗證並連結我的 LINE'))!.props.disabled).toBe(false);
});
it('requires verified LINE proof and refreshes linked statuses without creating a member',async()=>{
 line.prepareLineIdentityLink.mockResolvedValue('TEST_LINE_TOKEN');auth.linkLineIdentity.mockResolvedValue({linked:true});
 await act(async()=>{tree=create(<IdentityLinking/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 await act(async()=>tree!.root.findByType('button').props.onClick());
 expect(auth.linkLineIdentity).toHaveBeenCalledWith('TEST_LINE_TOKEN');
 expect(JSON.stringify(tree!.toJSON())).toContain('LINE 已連結，可用 LINE 或 Google');
});
it('does not link before LINE authentication redirects back',async()=>{
 line.prepareLineIdentityLink.mockResolvedValue(null);
 await act(async()=>{tree=create(<IdentityLinking/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 await act(async()=>tree!.root.findByType('button').props.onClick());
 expect(auth.linkLineIdentity).not.toHaveBeenCalled();
});
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
