import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {listActivityLabel,listPlanLabel,QualificationsPage} from './QualificationsPage';

vi.mock('../../lib/api',()=>({
 get:vi.fn(),
 qs:(values:Record<string,string|undefined>)=>'?'+new URLSearchParams(Object.entries(values).filter((entry):entry is [string,string]=>entry[1]!==undefined)).toString(),
}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'MEMBERSHIP_OPS'}})}));

const companyBootstrap={qualificationId:'bootstrap-ball',ballNo:'A000001',kind:'COMPANY_BOOTSTRAP' as const,currentHolderPersonId:null,currentCompanyPrincipalId:'company-principal',planLevelCode:'LEADER' as const,status:'EFFECTIVE' as const,activeFlag:false};
const memberOriginCompanyHeld={qualificationId:'member-company-held',ballNo:'A000004',kind:'MEMBER_ORIGIN' as const,currentHolderPersonId:null,currentCompanyPrincipalId:'company-principal',planLevelCode:'STARTER' as const,status:'EFFECTIVE' as const,activeFlag:false};
const activeMember={qualificationId:'member-active',ballNo:'A000005',kind:'MEMBER_ORIGIN' as const,currentHolderPersonId:'person-a',currentCompanyPrincipalId:null,planLevelCode:'ELITE' as const,status:'EFFECTIVE' as const,activeFlag:true,currentHolder:{personId:'person-a',memberNo:'2609000001',legalName:'測試會員'}};

beforeEach(()=>{vi.mocked(get).mockReset().mockResolvedValue({data:[companyBootstrap,memberOriginCompanyHeld,activeMember]});});

it('includes pending qualifications by default and allows explicitly filtering drafts',async()=>{
 const pending={...activeMember,qualificationId:'pending-member',ballNo:null,status:'DRAFT',activeFlag:false};
 vi.mocked(get).mockImplementation(async(url:string)=>({data:new URL(url,'https://test.invalid').searchParams.get('status')==='EFFECTIVE'?[activeMember]:[pending,activeMember]}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<MemoryRouter><QueryClientProvider client={client}><QualificationsPage/></QueryClientProvider></MemoryRouter>);});
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('尚未編配球號'));
 expect(get).toHaveBeenCalledWith('/admin/qualifications?q=&take=100');
 const filter=view!.root.findAllByType('select').find(node=>node.findAllByType('option').some(option=>option.props.value==='DRAFT'))!;
 expect(filter.props.value).toBe('');
 expect(filter.findAllByType('option').some(option=>option.props.value==='DRAFT')).toBe(true);
 await act(async()=>filter.props.onChange({target:{value:'EFFECTIVE'}}));
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).not.toContain('尚未編配球號'));
 await act(async()=>filter.props.onChange({target:{value:'DRAFT'}}));
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('尚未編配球號'));
 expect(get).toHaveBeenCalledWith('/admin/qualifications?q=&status=DRAFT&take=100');
 act(()=>view!.unmount());
 client.clear();
});

it('keeps list Company Active and bootstrap LEADER claims neutral until Ball 360 supplies binding evidence',()=>{
 expect(listPlanLabel(companyBootstrap)).toBe("方案請於 球 360 確認");
 expect(listActivityLabel(companyBootstrap)).toEqual({label:'活躍 狀態請於 球 360 確認',tone:'neutral'});
 expect(listPlanLabel(memberOriginCompanyHeld)).toBe('STARTER');
 expect(listActivityLabel(memberOriginCompanyHeld)).toEqual({label:'活躍 狀態請於 球 360 確認',tone:'neutral'});
 expect(listActivityLabel(activeMember)).toEqual({label:'活躍',tone:'ok'});
});

it('does not render raw Company ownership as Always Active or bootstrap LEADER in the list',async()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<MemoryRouter initialEntries={['/admin/qualifications']}><QueryClientProvider client={client}><QualificationsPage/></QueryClientProvider></MemoryRouter>);});
 await vi.waitFor(()=>expect(JSON.stringify(view!.toJSON())).toContain('A000005'));
 const output=JSON.stringify(view!.toJSON());
 expect(output).toContain("方案請於 球 360 確認");
 expect(output).toContain("啟航");
 expect(output).toContain("活躍 狀態請於 球 360 確認");
 expect(output).toContain("活躍");
 expect(output).not.toContain('Always Active (Company Rule)');
 expect(output).not.toContain('LEADER');
 expect(output).not.toContain('company-principal');
 act(()=>view!.unmount());
});
