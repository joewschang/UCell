import React from 'react';
import {act,create} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
import {MemberWelcome} from './MemberHubs';
let membershipState:string|undefined;
vi.mock('./useResource',()=>({useResource:()=>({data:membershipState?{membershipState}:undefined})}));
vi.mock('./memberData',()=>({getPerson:vi.fn()}));
it.each(['FORMAL_MEMBER',undefined])('does not offer formal membership to formal or unresolved members (%s)',state=>{
 membershipState=state;let view:ReturnType<typeof create>;
 act(()=>{view=create(<MemoryRouter><MemberWelcome/></MemoryRouter>);});
 expect(JSON.stringify(view!.toJSON())).not.toContain('開啟更多會員服務');
 expect(JSON.stringify(view!.toJSON())).toContain('商品商城');act(()=>view!.unmount());
});
it('keeps the application entry for network members',()=>{
 membershipState='NETWORK_MEMBER';let view:ReturnType<typeof create>;
 act(()=>{view=create(<MemoryRouter><MemberWelcome/></MemoryRouter>);});
 expect(JSON.stringify(view!.toJSON())).toContain('開啟更多會員服務');act(()=>view!.unmount());
});
