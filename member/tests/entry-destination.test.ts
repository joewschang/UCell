import {expect,it} from 'vitest';
import {memberEntryDestination} from '../src/entryDestination';
it('retains the event code after login but never follows external return targets',()=>{
 expect(memberEntryDestination({pathname:'/events',search:'?event=UCELL_2026'})).toBe('/events?event=UCELL_2026');
 expect(memberEntryDestination({pathname:'/events',search:'?event=https://example.com'})).toBe('/events');
 expect(memberEntryDestination({pathname:'/',search:'?mode=register&next=https://example.com'})).toBe('/');
 expect(memberEntryDestination({pathname:'/shop',search:'?anything=1'})).toBe('/shop');
});
it('preserves only allowlisted service paths and validated product intent',()=>{
 for(const pathname of ['/orders','/me','/learning','/membership/upgrade'])expect(memberEntryDestination({pathname,search:'?next=https://evil.invalid'})).toBe(pathname);
 expect(memberEntryDestination({pathname:'/shop',search:'?sku=TIP-636&next=//evil.invalid'})).toBe('/shop?sku=TIP-636');
 expect(memberEntryDestination({pathname:'/shop',search:'?sku=TIP-636%2F..'})).toBe('/shop');
 expect(memberEntryDestination({pathname:'//evil.invalid',search:''})).toBe('/');
});
