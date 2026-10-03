import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import FormalUpgrade from '../src/FormalUpgrade';
import {consentFormalContract,saveFormalDraft} from '../src/memberData';
vi.mock('../src/useResource',()=>({useResource:()=>({data:[{id:'CONTRACT',title:'Stage 測試契約',version:'TEST',content:'',contentHash:'a'.repeat(64),acceptedAt:'2026-10-03T00:00:00Z'}],retry:vi.fn()})}));
vi.mock('../src/memberData',()=>({getFormalRequiredContracts:vi.fn(),consentFormalContract:vi.fn(),uploadFormalDocument:vi.fn(),submitFormalEnrollment:vi.fn(),saveFormalDraft:vi.fn(async()=>({id:'DRAFT',version:1,identityDocumentNumberMasked:null,spouseIdentityDocumentNumberMasked:null,bankAccountMasked:'****',applicantType:'INDIVIDUAL'}))}));
it('saves a draft after an already-recorded contract consent without asking for duplicate consent',async()=>{
 let tree:any;await act(async()=>{tree=create(<FormalUpgrade/>)});
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(consentFormalContract).not.toHaveBeenCalled();expect(saveFormalDraft).toHaveBeenCalledOnce();
 expect(JSON.stringify(tree.toJSON())).toContain('已保存第');act(()=>tree.unmount());
});
