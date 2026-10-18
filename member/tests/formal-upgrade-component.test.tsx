import {MemberSignature} from '../src/MemberSignature';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import FormalUpgrade from '../src/FormalUpgrade';
import {consentFormalContract,saveFormalDraft,uploadFormalDocument} from '../src/memberData';
vi.mock('../src/useResource',()=>({useResource:()=>({data:[{id:'CONTRACT',title:'Stage 測試契約',version:'TEST',content:'',contentHash:'a'.repeat(64),acceptedAt:'2026-10-03T00:00:00Z'}],retry:vi.fn()})}));
vi.mock('../src/memberData',()=>({getFormalRequiredContracts:vi.fn(),consentFormalContract:vi.fn(),uploadFormalDocument:vi.fn(),submitFormalEnrollment:vi.fn(),saveFormalDraft:vi.fn(async()=>({id:'DRAFT',version:1,identityDocumentNumberMasked:null,spouseIdentityDocumentNumberMasked:null,bankAccountMasked:'****',applicantType:'INDIVIDUAL'}))}));
it('saves a draft after an already-recorded contract consent without asking for duplicate consent',async()=>{
 let tree:any;await act(async()=>{tree=create(<FormalUpgrade/>)});
 act(()=>tree.root.findByType(MemberSignature).props.onChange(new File(['signature'],'signature.png',{type:'image/png'})));
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(consentFormalContract).not.toHaveBeenCalled();expect(saveFormalDraft).toHaveBeenCalledOnce();
 expect(JSON.stringify(tree.toJSON())).toContain('已保存第');act(()=>tree.unmount());
});

it('does not enable submission after failed photo upload and retries only unfinished photos',async()=>{
 vi.mocked(uploadFormalDocument).mockResolvedValueOnce({scanStatus:'PENDING'} as any).mockRejectedValueOnce(new Error('413')).mockResolvedValue({scanStatus:'PENDING'} as any);
 let tree:any;await act(async()=>{tree=create(<FormalUpgrade/>)});
 act(()=>tree.root.findByType(MemberSignature).props.onChange(new File(['signature'],'signature.png',{type:'image/png'})));
 const files=tree.root.findAllByProps({type:'file'});
 act(()=>files[0].props.onChange({target:{files:[{name:'front.jpg'}]}}));act(()=>files[1].props.onChange({target:{files:[{name:'back.jpg'}]}}));
 expect(JSON.stringify(tree.toJSON())).toContain('尚未上傳');
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(JSON.stringify(tree.toJSON())).toContain('身分證明反面上傳未完成');
 expect(tree.root.findAllByType('button').some((n:any)=>n.children.includes('送出正式會員申請'))).toBe(false);
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 expect(vi.mocked(uploadFormalDocument).mock.calls.map(c=>c[1])).toEqual(['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK','IDENTITY_BACK','SIGNED_APPLICATION_AGREEMENT']);
 expect(tree.root.findAllByType('button').some((n:any)=>n.children.includes('送出正式會員申請'))).toBe(true);
 act(()=>files[0].props.onChange({target:{files:[{name:'replacement.jpg'}]}}));
 expect(tree.root.findAllByType('button').some((n:any)=>n.children.includes('送出正式會員申請'))).toBe(false);
 act(()=>tree.unmount());
});

it('keeps the key for unchanged retries but replaces it after editing a draft whose upload failed',async()=>{
 vi.clearAllMocks();vi.mocked(uploadFormalDocument).mockReset().mockRejectedValue(new Error('invalid photo'));
 let tree:any;await act(async()=>{tree=create(<FormalUpgrade/>)});
 act(()=>tree.root.findByType(MemberSignature).props.onChange(new File(['signature'],'signature.png',{type:'image/png'})));
 act(()=>tree.root.findAllByProps({type:'file'})[0].props.onChange({target:{files:[{name:'photo.jpg'}]}}));
 const save=()=>act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));
 await save();await save();
 const first=vi.mocked(saveFormalDraft).mock.calls[0];expect(vi.mocked(saveFormalDraft).mock.calls[1][1]).toBe(first[1]);
 act(()=>tree.root.findByProps({'aria-label':'推薦球號'}).props.onChange({target:{value:'UCELL001X000001'}}));
 act(()=>tree.root.findByType(MemberSignature).props.onChange(new File(['signature'],'signature.png',{type:'image/png'})));
 await save();const changed=vi.mocked(saveFormalDraft).mock.calls[2];expect(changed[0].sponsorBallNo).toBe('UCELL001X000001');expect(changed[1]).not.toBe(first[1]);
 await save();expect(vi.mocked(saveFormalDraft).mock.calls[3][1]).toBe(changed[1]);act(()=>tree.unmount());
});

it('blocks an unsigned application before saving or uploading',async()=>{vi.clearAllMocks();let tree:any;await act(async()=>{tree=create(<FormalUpgrade/>)});await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault:vi.fn()}));expect(saveFormalDraft).not.toHaveBeenCalled();expect(uploadFormalDocument).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('請先完成會員本人簽名');act(()=>tree.unmount());});
