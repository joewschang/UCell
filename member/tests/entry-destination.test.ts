import {expect,it} from 'vitest';
import {memberEntryDestination} from '../src/entryDestination';
it('retains the event code after login but never follows external return targets',()=>{
 expect(memberEntryDestination({pathname:'/events',search:'?event=UCELL_2026'})).toBe('/events?event=UCELL_2026');
 expect(memberEntryDestination({pathname:'/events',search:'?event=https://example.com'})).toBe('/events');
 expect(memberEntryDestination({pathname:'/',search:'?mode=register&next=https://example.com'})).toBe('/');
 expect(memberEntryDestination({pathname:'/shop',search:'?anything=1'})).toBe('/shop');
});
