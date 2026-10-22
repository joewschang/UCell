import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {get} from '../../lib/api';
import {SearchSelect} from '../../components/SearchSelect';
import {OrganizationPage} from './OrganizationPage';
import {TreeView} from '../../components/TreeView';
vi.mock('../../lib/api',()=>({get:vi.fn(),qs:()=>''}));
vi.mock('../auth/auth',()=>({useAuth:()=>({user:{role:'SUPER_ADMIN'}})}));
it('selects and displays a root by public ball number, including company balls',async()=>{
 vi.mocked(get).mockResolvedValue({data:[{qualificationId:'internal-company-id',qualificationNo:'123',ballNo:'AX000001',kind:'COMPANY_BOOTSTRAP'},{qualificationId:'internal-person-id',ballNo:'A000002',currentHolder:{memberNo:'2609000002'}}]});
 let view:ReturnType<typeof create>;
 act(()=>{view=create(<MemoryRouter><OrganizationPage/></MemoryRouter>)});
 const search=view!.root.findByType(SearchSelect);expect(search.props.label).toBe('根球球號');
 let options:any;await act(async()=>{options=await search.props.search('ax000001')});
 expect(options).toEqual([{id:'internal-company-id',primary:'AX000001',secondary:'公司球'}]);
 act(()=>search.props.onChange(options[0]));
 vi.mocked(get).mockResolvedValueOnce({data:[{qualification_id:'internal-company-id',qualification_no:'123',ball_no:'AX000001',qualification_kind:'COMPANY_BOOTSTRAP',depth:0}]});
 await act(async()=>view!.root.findAllByType('button').find(b=>b.children.join('')==='載入組織')!.props.onClick());
 const json=JSON.stringify(view!.toJSON());expect(json).toContain('AX000001');expect(json).not.toContain('internal-company-id');expect(json).not.toContain('Q#123');
 act(()=>view!.unmount());
});
it('keeps company nodes visible when they have no personal holder',()=>{
 const view=create(<TreeView mode="BINARY" nodes={[{qualification_id:'root',ball_no:'AX000001',qualification_kind:'COMPANY_BOOTSTRAP',depth:0},{qualification_id:'child',ball_no:'AX000002',qualification_kind:'COMPANY_BOOTSTRAP',depth:1,parent_qualification_id:'root',side:'LEFT'}]}/>);
 const output=JSON.stringify(view.toJSON());expect(output).toContain('AX000001');expect(output).toContain('AX000002');expect(output).toContain('公司球');view.unmount();
});
it('discards an organization response after the selected root changes',async()=>{
 let resolve!:(value:any)=>void;vi.mocked(get).mockReturnValue(new Promise(r=>resolve=r));let view!:ReturnType<typeof create>;
 await act(async()=>{view=create(<MemoryRouter><OrganizationPage/></MemoryRouter>)});
 act(()=>view.root.findByType(SearchSelect).props.onChange({id:'old',primary:'A000001'}));
 act(()=>view.root.findAllByType('button').find(b=>b.children.join('')==='載入組織')!.props.onClick());
 act(()=>view.root.findByType(SearchSelect).props.onChange({id:'new',primary:'A000002'}));
 await act(async()=>resolve({data:[{qualification_id:'old',ball_no:'A000001',depth:0}]}));
 expect(view.root.findAllByType(TreeView)).toHaveLength(0);expect(JSON.stringify(view.toJSON())).not.toContain('A000001');act(()=>view.unmount());
});
