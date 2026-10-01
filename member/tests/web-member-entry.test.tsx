import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';

const auth=vi.hoisted(()=>({
 passwordLogin:vi.fn(),forgotPassword:vi.fn(),resetPassword:vi.fn(),completeRegistration:vi.fn(),
 registrationContract:vi.fn(),renderGoogleButton:vi.fn(),renderGoogleRegistrationButton:vi.fn()
}));
vi.mock('../src/webAuth',()=>auth);
import WebMemberEntry from '../src/WebMemberEntry';

let tree:ReactTestRenderer|undefined;
beforeEach(()=>{
 auth.registrationContract.mockResolvedValue({contractVersionId:'11111111-1111-4111-8111-111111111111',title:'會員契約',versionCode:'R1',contentText:'TEST CONTRACT',contentHash:'a'.repeat(64)});
 auth.renderGoogleButton.mockImplementation(async()=>{});
 auth.renderGoogleRegistrationButton.mockImplementation(async()=>{});
 vi.stubGlobal('window',{location:{search:'',pathname:'/'},history:{replaceState:vi.fn()}});
});
afterEach(()=>{if(tree)act(()=>tree!.unmount());tree=undefined;vi.clearAllMocks();vi.unstubAllGlobals();});

it('shows active Web login methods and keeps SMS OTP explicitly deferred',async()=>{
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()}/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 const text=JSON.stringify(tree!.toJSON());
 expect(text).toContain('使用 LINE 登入');
 expect(text).toContain('會員編號 + 密碼登入');
 expect(text).toContain('Google 登入');
 expect(text).toContain('手機 OTP 登入將於簡訊供應商 API 完成後開放');
 expect(text).not.toContain('取得驗證碼');
});

it('requires Google identity before Web registration and submits no OTP fields',async()=>{
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()}/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 const register=tree!.root.findAllByType('button').find(n=>n.children.includes('註冊會員'))!;
 await act(async()=>register.props.onClick());
 expect(auth.registrationContract).toHaveBeenCalledOnce();
 const form=tree!.root.findByType('form');
 await act(async()=>form.props.onSubmit({preventDefault(){}}));
 expect(JSON.stringify(tree!.toJSON())).toContain('請先完成 Google 身分驗證');
 expect(auth.completeRegistration).not.toHaveBeenCalled();
});

it('registers with Google, contract consent and password without OTP fields',async()=>{
 let googleCredential:(token:string)=>void=()=>{};
 auth.renderGoogleRegistrationButton.mockImplementation(async(_el:any,onCredential:(token:string)=>void)=>{googleCredential=onCredential;});
 const authenticated=vi.fn();
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={authenticated}/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 const register=tree!.root.findAllByType('button').find(n=>n.children.includes('註冊會員'))!;
 await act(async()=>register.props.onClick());
 await act(async()=>{await Promise.resolve();});
 expect(auth.renderGoogleRegistrationButton).toHaveBeenCalled();
 await act(async()=>googleCredential('GOOGLE_ID_TOKEN_TEST_ONLY'));

 const labels=tree!.root.findAllByType('label');
 const input=(name:string)=>labels.find(l=>l.children.some(c=>typeof c==='string'&&c.includes(name)))!.findByType('input');
 await act(async()=>{
  input('姓名').props.onChange({target:{value:'王小明'}});
  input('顯示名稱').props.onChange({target:{value:'小明'}});
  input('生日').props.onChange({target:{value:'1990-01-01'}});
  input('手機號碼').props.onChange({target:{value:'+886912345678'}});
  input('Email').props.onChange({target:{value:'member@example.invalid'}});
  input('設定登入密碼').props.onChange({target:{value:'LongPassword123!'}});
  labels.find(l=>l.children.some(c=>typeof c==='string'&&c.includes('我已閱讀')))!.findByType('input').props.onChange({target:{checked:true}});
 });
 auth.completeRegistration.mockResolvedValue({accessToken:'opaque',expiresAt:new Date(Date.now()+60000).toISOString()});
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.completeRegistration).toHaveBeenCalledWith(expect.objectContaining({
  contractVersionId:'11111111-1111-4111-8111-111111111111',
  legalName:'王小明',alias:'小明',mobile:'+886912345678',email:'member@example.invalid',
  password:'LongPassword123!',googleIdToken:'GOOGLE_ID_TOKEN_TEST_ONLY'
 }));
 const payload=auth.completeRegistration.mock.calls[0][0];
 expect(payload).not.toHaveProperty('challengeId');
 expect(payload).not.toHaveProperty('registrationSessionId');
 expect(payload).not.toHaveProperty('otpCode');
 expect(authenticated).toHaveBeenCalledOnce();
});
