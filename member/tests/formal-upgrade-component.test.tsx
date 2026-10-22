import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import FormalUpgrade from '../src/FormalUpgrade';
import {consentFormalContract,saveFormalDraft} from '../src/memberData';
vi.mock('../src/useResource',()=>({useResource:()=>({data:[{id:'CONTRACT',title:'Stage 測試契約',version:'TEST',content:'',contentHash:'a'.repeat(64),acceptedAt:'2026-10-03T00:00:00Z'}],retry:vi.fn()})}));
vi.mock('../src/memberData',()=>({getFormalRequiredContracts:vi.fn(),consentFormalContract:vi.fn(),uploadFormalDocument:vi.fn(),submitFormalEnrollment:vi.fn(),saveFormalDraft:vi.fn(async()=>({id:'DRAFT',version:1,identityDocumentNumberMasked:null,spouseIdentityDocumentNumberMasked:null,bankAccountMasked:'****',applicantType:'INDIVIDUAL'}))}));
it('saves a draft after an already-recorded contract consent without asking for duplicate consent',async()=>{
 let tree:any;await act(async()=>{tree=create(<FormalUpgrade/>)});
 const values:Record<string,string>={'姓名':'測試會員','出生年月日':'1990-01-01','身分證明號碼':'A123456789','通訊地址':'臺北市中正區測試路1號','電話':'0912345678','電子郵件':'test@example.com','銀行別／代碼':'012','銀行帳號':'12345678','帳戶名':'測試會員'};
 for(const [label,value] of Object.entries(values)){const el=tree.root.findAllByType('label').find((x:any)=>x.children[0]===label);await act(async()=>el.findAll((x:any)=>x.type==='input'||x.type==='textarea')[0].props.onChange({target:{value}}));}
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(consentFormalContract).not.toHaveBeenCalled();expect(saveFormalDraft).toHaveBeenCalledOnce();
 expect(JSON.stringify(tree.toJSON())).toContain('已保存第');act(()=>tree.unmount());
});
