import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PaperFormalApplicationPage} from './PaperFormalApplicationPage';
import {SearchSelect} from '../../components/SearchSelect';
import {command,get} from '../../lib/api';
vi.mock('../../lib/api',()=>({get:vi.fn(),command:vi.fn(),qs:()=>''}));
let tree:ReactTestRenderer;
beforeEach(async()=>{
 vi.mocked(get).mockResolvedValue({data:[{id:'synthetic-contract',title:'TEST ONLY CONTRACT',version:'TEST'}]});
 vi.mocked(command).mockResolvedValue({data:{id:'synthetic-application',applicantType:'LEGAL_ENTITY',sourceChannel:'ADMIN_PAPER'}});
 await act(async()=>{tree=create(<PaperFormalApplicationPage/>)});
});
afterEach(()=>{act(()=>tree.unmount());vi.resetAllMocks()});
async function field(label:string,value:string){
 const row=tree.root.findAllByType('label').find(x=>x.children[0]===label);
 if(!row)throw Error('Missing field '+label);
 const control=row.findAll(x=>['input','select','textarea'].includes(String(x.type)))[0];
 await act(async()=>control.props.onChange({target:{value}}));
}
async function selectPerson(){await act(async()=>tree.root.findByType(SearchSelect).props.onChange({id:'synthetic-person',primary:'TEST ONLY PERSON'}))}
async function spouse(enabled:boolean){
 const box=tree.root.findAllByType('input').find(x=>x.props.type==='checkbox')!;
 await act(async()=>box.props.onChange({target:{checked:enabled}}));
}
async function common(){
 await selectPerson();
 for(const [label,value] of [['紙本申請編號','TEST-PAPER'],['通訊地址','TEST ONLY ADDRESS'],['電話','TEST ONLY PHONE'],['Email','paper@example.invalid'],['銀行代碼','TEST'],['銀行帳號','TEST ONLY BANK'],['帳戶名','TEST ONLY HOLDER']])await field(label,value);
}
it('keeps the selected Person as representative and excludes stale individual data after switching to a corporation',async()=>{
 await common();await field('姓名','STALE INDIVIDUAL');await field('身分證明號碼','STALE ID');
 await field('申請類型','LEGAL_ENTITY');
 for(const [label,value] of [['法人名稱','TEST ONLY CORPORATION'],['統一編號／法人登記號碼','TEST-REGISTRATION'],['法人登記地址','TEST ADDRESS'],['主要經營代表人姓名','TEST REPRESENTATIVE'],['代表人身分證明號碼','TEST REP ID']])await field(label,value);
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 const [path,payload]=vi.mocked(command).mock.calls[0];
 expect(path).toBe('/admin/formal-member-applications/paper');
 expect(payload).toMatchObject({representativePersonId:'synthetic-person',formalContractVersionId:'synthetic-contract',applicantType:'LEGAL_ENTITY',legalEntityName:'TEST ONLY CORPORATION',representativeIdentityDocumentNumber:'TEST REP ID'});
 expect(payload).not.toHaveProperty('legalName');expect(payload).not.toHaveProperty('identityDocumentNumber');
 expect(JSON.stringify(tree.toJSON())).toContain('紙本申請已建立');
});
it('does not transmit a cleared spouse declaration or create an application without a selected Person',async()=>{
 await field('姓名','TEST ONLY APPLICANT');await spouse(true);
 await field('配偶姓名','STALE SPOUSE');await field('配偶身分證明號碼','STALE SPOUSE ID');await spouse(false);
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 expect(command).not.toHaveBeenCalled();
 await common();await field('性別','UNDISCLOSED');await field('出生日期','1990-01-02');await field('身分證明號碼','TEST ONLY ID');
 await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
 const payload=vi.mocked(command).mock.calls[0][1];
 expect(payload).toMatchObject({applicantType:'INDIVIDUAL',hasSpouse:false,identityDocumentNumber:'TEST ONLY ID'});
 expect(payload).not.toHaveProperty('spouseName');expect(payload).not.toHaveProperty('spouseIdentityDocumentNumber');
});
