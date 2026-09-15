import { api, type Dashboard, type Qualification } from './api';

const mockQualifications: Qualification[] = [
  { id:'q1', code:'Q-000123', rank:'LEADER', active:true, ballLabel:'球 1' },
  { id:'q2', code:'Q-000124', rank:'ELITE', active:true, ballLabel:'球 2' },
];
const rankName:Record<string,string>={STARTER:'啟航',ELITE:'菁英',LEADER:'領袖'};
export const displayRank=(rank:string)=>rankName[rank] ?? rank;

export async function getQualifications():Promise<Qualification[]> {
  if(import.meta.env.VITE_ENABLE_MOCK==='true') return mockQualifications;
  return api<Qualification[]>('/member/qualifications');
}
export async function getDashboard(q:Qualification):Promise<Dashboard>{
  if(import.meta.env.VITE_ENABLE_MOCK==='true') return {
    memberName:'UCell 會員', memberNo:'M-000001', qualification:q,
    monthlyRepurchaseStatus:'ACTIVE', pv:2880, rpv:1200, epv:1680,
    bonusAmount:null, bonusStatus:'PENDING'
  };
  return api<Dashboard>(`/member/dashboard?qualificationId=${encodeURIComponent(q.id)}`);
}
