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
it('keeps the selected ball and filters when collapsing and reopening the list',async()=>{
 vi.mocked(get).mockImplementation(async route=>({data:route==='/admin/qualifications/member-active'?activeMember:[activeMember]}));
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<MemoryRouter><QueryClientProvider client={client}><QualificationsPage/></QueryClientProvider></MemoryRouter>)});
 const row=()=>view.root.findByProps({'aria-controls':'ball-detail'});
 await vi.waitFor(()=>expect(row()).toBeDefined());
 act(()=>row().props.onClick());
 const detail=()=>view.root.findByProps({id:'ball-detail'});
 await vi.waitFor(()=>expect(JSON.stringify(detail().findAllByType('strong').map(x=>x.children))).toContain('測試會員'));
 for(const expanded of [false,true]){
  act(()=>view.root.findByProps({'aria-controls':'qualification-ball-list'}).props.onClick());
  expect(view!.root.findByProps({id:'qualification-ball-list'}).props.hidden).toBe(!expanded);
  expect(row().props['aria-pressed']).toBe(true);
  expect(detail().findAllByProps({role:'tablist'})).toHaveLength(1);
 }
 act(()=>view.unmount());
});

it('requests separate server pages, keeps selected details across pages and restarts filters at page one', async () => {
 const calls: URLSearchParams[] = [];
 vi.mocked(get).mockImplementation(async route => {
   if (route.startsWith('/admin/qualifications?')) {
     const query = new URL(route, 'https://test.local').searchParams;
     calls.push(query);
     const isSecond = query.get('page') === '2';
     return {data: [isSecond ? companyBootstrap : activeMember], meta: {page: isSecond ? 2 : 1, take: 8, hasNext: !isSecond}};
   }
   return {data: activeMember};
 });
 const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
 let view!: ReturnType<typeof create>;
 await act(async () => {view = create(<MemoryRouter initialEntries={['/admin/qualifications?qualificationId=member-active']}><QueryClientProvider client={client}><QualificationsPage/></QueryClientProvider></MemoryRouter>);});
 const pageButton = (name: string) => view.root.findAllByType('button').find(button => button.children[0] === name)!;
 await vi.waitFor(() => expect(view.root.findByProps({'aria-controls':'ball-detail'}).props['aria-pressed']).toBe(true));
 expect(calls[0].get('page')).toBe('1'); expect(calls[0].get('take')).toBe('8');
 expect(pageButton('上一頁').props.disabled).toBe(true);
 act(() => pageButton('下一頁').props.onClick());
 await vi.waitFor(() => expect(JSON.stringify(view.toJSON())).toContain('A000001'));
 expect(calls.at(-1)?.get('page')).toBe('2'); expect(pageButton('下一頁').props.disabled).toBe(true);
 expect(view.root.findByProps({id:'ball-detail'}).findAllByProps({role:'tablist'})).toHaveLength(1);
 act(() => view.root.findByProps({type:'search'}).props.onChange({target:{value:'  測試  '}}));
 await vi.waitFor(() => expect(calls.at(-1)?.get('q')).toBe('測試'));
 expect(calls.at(-1)?.get('page')).toBe('1');
 await vi.waitFor(() => expect(view.root.findByProps({'aria-controls':'ball-detail'}).props['aria-pressed']).toBe(true));
 act(() => view.unmount());
});
