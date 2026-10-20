import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';

const auth=vi.hoisted(()=>({
 passwordLogin:vi.fn(),forgotPassword:vi.fn(),resetPassword:vi.fn(),completeRegistration:vi.fn(),
 registrationContract:vi.fn(),renderGoogleButton:vi.fn(),renderGoogleRegistrationButton:vi.fn(),linkLineIdentity:vi.fn()
}));
vi.mock('../src/webAuth',()=>auth);
import WebMemberEntry from '../src/WebMemberEntry';
import ContactVerifier from '../src/ContactVerifier';

let tree:ReactTestRenderer|undefined;
it('opens the official website join link in registration mode without creating a member',async()=>{
 vi.stubGlobal('window',{location:{search:'?mode=register',pathname:'/'},history:{replaceState:vi.fn()}});
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()}/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 expect(JSON.stringify(tree!.toJSON())).toContain('選擇註冊方式');
 expect(auth.renderGoogleRegistrationButton).toHaveBeenCalled();
 expect(auth.completeRegistration).not.toHaveBeenCalled();
});
it('authenticates the original Google member before linking current LINE and never creates another member',async()=>{
 const done=vi.fn(),token=vi.fn(()=> 'TEST_LINE_PROOF');
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={done} lineRegistrationToken={token}/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.includes("已用 Google 或 網頁 註冊，登入並連結 LINE"))!.props.onClick());
 expect(auth.linkLineIdentity).not.toHaveBeenCalled();
 const callback=auth.renderGoogleButton.mock.calls.at(-1)![1];
 await act(async()=>{callback();});
 expect(auth.linkLineIdentity).toHaveBeenCalledWith('TEST_LINE_PROOF');expect(done).toHaveBeenCalledOnce();
 expect(auth.completeRegistration).not.toHaveBeenCalled();
});
it('stays on the linking screen on conflict instead of entering the wrong member account',async()=>{
 auth.linkLineIdentity.mockRejectedValueOnce(new Error('此 LINE 已連結其他會員'));
 const done=vi.fn();await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={done} lineRegistrationToken={()=>'TEST_LINE_PROOF'}/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.includes("已用 Google 或 網頁 註冊，登入並連結 LINE"))!.props.onClick());
 await act(async()=>auth.renderGoogleButton.mock.calls.at(-1)![1]());
 expect(done).not.toHaveBeenCalled();expect(JSON.stringify(tree!.toJSON())).toContain('此 LINE 已連結其他會員');
});
it('opens new LINE friends directly on profile registration and preserves an existing-member binding choice',async()=>{
 const authenticated=vi.fn(),existing=vi.fn(),token=vi.fn(()=> 'LINE_ID_TOKEN_TEST_ONLY');
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={authenticated} lineRegistrationToken={token} onExistingMemberBinding={existing}/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 expect(JSON.stringify(tree!.toJSON())).toContain('登錄會員資料');
 expect(JSON.stringify(tree!.toJSON())).toContain("電子郵件（聯絡資料）");
 expect(auth.renderGoogleRegistrationButton).not.toHaveBeenCalled();
 const labels=tree!.root.findAllByType('label');
 const input=(name:string)=>labels.find(l=>l.children.some(c=>typeof c==='string'&&c.includes(name)))!.findByType('input');
 act(()=>{
  for(const [name,value] of Object.entries({'姓名':'測試新好友','顯示名稱':'新好友','生日':'1990-01-01','身分證明號碼':'TEST-LINE-ID','手機號碼':'+886912345678','電子郵件':'line-friend@example.invalid','設定登入密碼':'abc123','確認密碼':'abc123'}))input(name).props.onChange({target:{value}});

 });
 act(()=>tree!.root.findAllByType(ContactVerifier).forEach(v=>v.props.onVerified('a'.repeat(64))));
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.completeRegistration).not.toHaveBeenCalled();
 expect(JSON.stringify(tree!.toJSON())).toContain('確認會員資料');
 act(()=>tree!.root.findAllByType('label').find(l=>l.children.some(c=>typeof c==='string'&&c.includes('我已閱讀')))!.findByType('input').props.onChange({target:{checked:true}}));
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.completeRegistration).toHaveBeenCalledWith(expect.objectContaining({lineIdToken:'LINE_ID_TOKEN_TEST_ONLY'}));
 expect(auth.completeRegistration.mock.calls[0][0]).not.toHaveProperty('googleIdToken');
 expect(token).toHaveBeenCalledOnce();expect(authenticated).toHaveBeenCalledOnce();
 const choose=tree!.root.findAllByType('button').find(n=>n.children.includes('我是既有會員，改用安全綁定'))!;
 act(()=>choose.props.onClick());expect(existing).toHaveBeenCalledOnce();
});
beforeEach(()=>{vi.stubEnv('VITE_GOOGLE_OIDC_CLIENT_ID','test-client');
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
 expect(text).toContain("會員編號、電子郵件 或手機號碼");
 expect(text).toContain('Google 登入');
 expect(text).toContain("手機驗證碼登入尚未開放");
 expect(text).not.toContain('取得驗證碼');
});

it('requires Google identity before Web registration and submits no OTP fields',async()=>{
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()}/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 const register=tree!.root.findAllByType('button').find(n=>n.children.includes('註冊會員'))!;
 await act(async()=>register.props.onClick());
 expect(auth.registrationContract).toHaveBeenCalledOnce();
 const form=tree!.root.findByType('form');
 await act(async()=>form.props.onSubmit({preventDefault(){}}));
 expect(JSON.stringify(tree!.toJSON())).toContain('請先選擇登入方式並完成身分驗證');
 expect(auth.completeRegistration).not.toHaveBeenCalled();
});

it.each([true,false])('registers with Google and contract consent with contact verification required=%s',async(required)=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({emailRequired:required,smsRequired:required}))));
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
  input('身分證明號碼').props.onChange({target:{value:'TEST ONLY ID'}});
  input('手機號碼').props.onChange({target:{value:'+886912345678'}});
  input('電子郵件').props.onChange({target:{value:'member@example.invalid'}});
  input('設定登入密碼').props.onChange({target:{value:'abc123'}});
  input('確認密碼').props.onChange({target:{value:'DifferentPassword123!'}});

 });
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.completeRegistration).not.toHaveBeenCalled();
 expect(JSON.stringify(tree!.toJSON())).toContain('兩次輸入的密碼不一致');
 await act(async()=>input('確認密碼').props.onChange({target:{value:'abc123'}}));
 auth.completeRegistration.mockResolvedValue({accessToken:'opaque',expiresAt:new Date(Date.now()+60000).toISOString()});
 act(()=>tree!.root.findAllByType(ContactVerifier).forEach(v=>v.props.onVerified('a'.repeat(64))));
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.completeRegistration).not.toHaveBeenCalled();
 expect(JSON.stringify(tree!.toJSON())).toContain('確認會員資料');
 act(()=>tree!.root.findAllByType('label').find(l=>l.children.some(c=>typeof c==='string'&&c.includes('我已閱讀')))!.findByType('input').props.onChange({target:{checked:true}}));
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(auth.completeRegistration).toHaveBeenCalledWith(expect.objectContaining({
  contractVersionId:'11111111-1111-4111-8111-111111111111',
  legalName:'王小明',alias:'小明',mobile:'+886912345678',email:'member@example.invalid',
  password:'abc123',googleIdToken:'GOOGLE_ID_TOKEN_TEST_ONLY',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:'TEST ONLY ID'
 }));
 const payload=auth.completeRegistration.mock.calls[0][0];
 expect(payload).not.toHaveProperty('challengeId');
 expect(payload).not.toHaveProperty('registrationSessionId');
 expect(payload).not.toHaveProperty('otpCode');
 expect(authenticated).toHaveBeenCalledOnce();
});

it('shows an actionable contract failure, disables registration and allows retry',async()=>{
 auth.registrationContract.mockRejectedValueOnce(new Error('NETWORK_CONTRACT_NOT_CONFIGURED'));
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()}/>,{createNodeMock:element=>element.type==='div'?{}:null});});
 await act(async()=>tree!.root.findAllByType('button').find(n=>n.children.includes('註冊會員'))!.props.onClick());
 expect(JSON.stringify(tree!.toJSON())).toContain('會員契約尚未開放');
 expect(JSON.stringify(tree!.toJSON())).not.toContain('NETWORK_CONTRACT_NOT_CONFIGURED');
 expect(tree!.root.findAllByType('button').find(n=>n.children.includes('下一步'))!.props.disabled).toBe(true);
 await act(async()=>tree!.root.findAllByType('button').find(n=>n.children.includes('重新載入會員契約'))!.props.onClick());
 expect(auth.registrationContract).toHaveBeenCalledTimes(2);expect(JSON.stringify(tree!.toJSON())).not.toContain('會員契約尚未開放');
});
it('offers LINE registration when Google is not configured',async()=>{
 vi.stubEnv('VITE_GOOGLE_OIDC_CLIENT_ID','');vi.stubGlobal('window',{location:{search:'?mode=register',pathname:'/'},history:{replaceState:vi.fn()}});
 const line=vi.fn().mockResolvedValue(undefined);
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={line} onAuthenticated={vi.fn()}/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 expect(auth.renderGoogleRegistrationButton).not.toHaveBeenCalled();
 await act(async()=>tree!.root.findAllByType('button').find(b=>b.children.includes('使用 LINE 註冊'))!.props.onClick());
 expect(line).toHaveBeenCalledOnce();expect(auth.completeRegistration).not.toHaveBeenCalled();
});
it('preserves profile fields on back navigation and requires fresh consent after editing',async()=>{
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()} lineRegistrationToken={()=>'TEST_LINE_PROOF'}/>,{createNodeMock:e=>e.type==='div'?{}:null});});
 const input=(name:string)=>tree!.root.findAllByType('label').find(l=>l.children.some(c=>typeof c==='string'&&c.includes(name)))!.findByType('input');
 act(()=>{input('姓名').props.onChange({target:{value:'測試會員'}});input('設定登入密碼').props.onChange({target:{value:'abc123'}});input('確認密碼').props.onChange({target:{value:'abc123'}});tree!.root.findAllByType(ContactVerifier).forEach(v=>v.props.onVerified('a'.repeat(64)));});
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(JSON.stringify(tree!.toJSON())).toContain('確認會員資料');act(()=>input('我已閱讀').props.onChange({target:{checked:true}}));
 act(()=>tree!.root.findAllByType('button').find(b=>b.children.includes('上一步'))!.props.onClick());expect(input('姓名').props.value).toBe('測試會員');expect(input('設定登入密碼').props.type).toBe('password');act(()=>tree!.root.findAllByType(ContactVerifier).forEach(v=>v.props.onVerified('a'.repeat(64))));
 await act(async()=>tree!.root.findByType('form').props.onSubmit({preventDefault(){}}));expect(input('我已閱讀').props.checked).toBe(false);expect(auth.completeRegistration).not.toHaveBeenCalled();
});
it('toggles both registration passwords without changing their values',async()=>{
 await act(async()=>{tree=create(<WebMemberEntry onLineLogin={vi.fn()} onAuthenticated={vi.fn()} lineRegistrationToken={()=>'TEST_LINE_PROOF'}/>);});
 const field=(name:string)=>tree!.root.findAllByType('label').find(l=>l.children.some(c=>typeof c==='string'&&c.includes(name)))!.findByType('input');
 act(()=>field('設定登入密碼').props.onChange({target:{value:'abc123'}}));
 expect(field('設定登入密碼').props.type).toBe('password');
 act(()=>field('顯示密碼').props.onChange({target:{checked:true}}));
 expect(field('設定登入密碼').props.type).toBe('text');expect(field('確認密碼').props.type).toBe('text');expect(field('設定登入密碼').props.value).toBe('abc123');
 act(()=>field('顯示密碼').props.onChange({target:{checked:false}}));expect(field('設定登入密碼').props.type).toBe('password');
});
