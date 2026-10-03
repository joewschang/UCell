import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {QualificationProvider} from '../src/QualificationContext';
import {BallRankBadge,MembershipPlanEmblem} from '../src/MembershipEmblems';
import * as data from '../src/memberData';
vi.mock('../src/memberData',()=>({getQualifications:vi.fn(),getPerson:vi.fn(),getGrowth:vi.fn(),selectQualification:vi.fn()}));
const qualifications=['1','2','3'].map((qualificationNo,index)=>({id:qualificationNo,qualificationNo,code:'Q'+qualificationNo,rank:['LEADER','STARTER','ELITE'][index],active:true,ballLabel:qualificationNo}));
const setup=()=>{vi.mocked(data.getQualifications).mockResolvedValue(qualifications);vi.mocked(data.getPerson).mockRejectedValue(new Error('optional'));};
it('renders distinct recorded ranks beside Ball identities, without inferring from package level',async()=>{
 setup();vi.mocked(data.getGrowth).mockResolvedValue({asOf:'2026-10-03T00:00:00Z',dimensions:{globalRank:{achieved:[{qualificationNo:'1',rankCode:'NEW_STAR',achievedAt:'2026-10-01T00:00:00Z'},{qualificationNo:'2',rankCode:'CROWN',achievedAt:'2026-10-01T00:00:00Z'}]}}} as any);
 let tree:any;await act(async()=>{tree=create(<QualificationProvider>{qualifications.map(q=><section key={q.id} data-ball={q.id}><MembershipPlanEmblem code={q.rank}/><BallRankBadge qualificationNo={q.qualificationNo}/></section>)}</QualificationProvider>);});
 const first=tree.root.findByProps({'data-ball':'1'}),second=tree.root.findByProps({'data-ball':'2'}),third=tree.root.findByProps({'data-ball':'3'});
 expect(first.findByProps({'data-kind':'rank'}).props['data-code']).toBe('NEW_STAR');
 expect(second.findByProps({'data-kind':'rank'}).props['data-code']).toBe('CROWN');
 expect(third.findAllByProps({'data-kind':'rank'})).toHaveLength(0);expect(JSON.stringify(third.toJSON?.()??tree.toJSON())).toContain('尚無已達成聘階');
 await act(async()=>tree.unmount());
});
it('keeps qualification content usable when rank read fails, and labels it unavailable',async()=>{
 setup();vi.mocked(data.getGrowth).mockRejectedValue(new Error('network'));let tree:any;
 await act(async()=>{tree=create(<QualificationProvider><MembershipPlanEmblem code="STARTER"/><BallRankBadge qualificationNo="1"/></QualificationProvider>);});
 expect(tree.root.findAllByProps({'data-kind':'plan'})).toHaveLength(1);expect(tree.root.findAllByProps({'data-kind':'rank'})).toHaveLength(0);expect(JSON.stringify(tree.toJSON())).toContain('聘階資料待確認');await act(async()=>tree.unmount());
});
