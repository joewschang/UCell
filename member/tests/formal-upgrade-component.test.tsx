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

it('retains completed documents on failure and proceeds after retrying only the remaining files',async()=>{
 const {uploadFormalDocument}=await import('../src/memberData');
 vi.mocked(saveFormalDraft).mockClear();
 vi.mocked(uploadFormalDocument).mockReset();
 vi.mocked(uploadFormalDocument).mockResolvedValueOnce({scanStatus:'PENDING'} as any).mockRejectedValueOnce(new Error('連線逾時')).mockResolvedValue({scanStatus:'PENDING'} as any);
 const onSaved=vi.fn();let tree:any;
 await act(async()=>{tree=create(<FormalUpgrade draftOnly onSaved={onSaved} initial={{prefill:{legalName:'測試',birthDate:'1990-01-01',identityDocumentNumber:'A123456789',communicationAddress:'測試地址',phone:'0912345678',email:'test@example.com',bankCode:'012',bankAccount:'12345678',accountHolder:'測試'}} as any}/>)});
 for(const input of tree.root.findAllByType('input').filter((x:any)=>x.props.type==='file'))await act(async()=>input.props.onChange({target:{files:[new File(['test image'],'test.png',{type:'image/png'})]}}));
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(onSaved).not.toHaveBeenCalled();expect(uploadFormalDocument).toHaveBeenCalledTimes(3);
 expect(JSON.stringify(tree.toJSON())).toContain('身分證明文件反面上傳失敗');
 expect(JSON.stringify(tree.toJSON())).toContain('已上傳');
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(vi.mocked(uploadFormalDocument).mock.calls.map(c=>c[1])).toEqual(['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','IDENTITY_BACK']);
 expect(vi.mocked(saveFormalDraft).mock.calls[0][1]).not.toBe(vi.mocked(saveFormalDraft).mock.calls[1][1]);
 expect(onSaved).toHaveBeenCalledWith('DRAFT');act(()=>tree.unmount());
});
