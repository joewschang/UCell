import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import GrowthCenter from '../src/GrowthCenter';
import {getGrowth} from '../src/memberData';
vi.mock('../src/memberData',()=>({getGrowth:vi.fn()}));
it('shows exact server totals separately from bounded lists and distinguishes check-in from attendance',async()=>{
 vi.mocked(getGrowth).mockResolvedValue({asOf:'2026-10-01T00:00:00Z',coverage:{learningItems:1,eventItems:1,itemLimit:100,milestoneLimit:20,counts:'ALL_PERSON_RECORDS'},milestones:[{type:'EVENT_CHECKED_IN',title:'活動',occurredAt:'2026-10-01T00:00:00Z',reference:'EVENT:TEST_EVENT',link:'/events?event=TEST_EVENT'}],dimensions:{qualification:{items:[]},active:{activeQualificationCount:0,totalQualificationCount:0,items:[]},globalRank:{achieved:[],nextAchievement:{status:'UNAVAILABLE',reason:'尚無核准資料',basis:'ORIGINAL_CLOSED_PERIOD',items:[]}},organization:{directQualifiedCount:0},repurchase:{items:[]},learning:{enrolledCount:105,completedCount:101,items:[{courseCode:'TEST_COURSE',title:'課程',status:'COMPLETED'}]},events:{upcomingRegisteredCount:2,attendedCount:101,checkedInCount:3,items:[{eventCode:'TEST_EVENT',title:'活動',status:'CHECKED_IN',startsAt:'2026-10-01T00:00:00Z'}]}}});
 let tree:any;await act(async()=>{tree=create(<MemoryRouter><GrowthCenter/></MemoryRouter>);});const text=JSON.stringify(tree.toJSON());expect(text).toContain('101');expect(text).toContain('場已報到尚未確認出席');expect(text).toContain('已報到不會計入已確認出席');expect(text).not.toContain('CHECKED_IN');expect(text).not.toContain('UNAVAILABLE');expect(tree.root.findAllByProps({href:'/events?event=TEST_EVENT'}).length).toBeGreaterThan(0);expect(tree.root.findAllByProps({href:'/orders'})).toHaveLength(0);await act(async()=>tree.unmount());
});
