import { describe,expect,it } from 'vitest';
import { lineRichMenuRoutes,lineRichMenuTarget } from '../src/lineDeepLinks';
describe('LINE Rich Menu deep links',()=>{
 it('maps every approved action to an internal Experience V2 route',()=>{
  expect(lineRichMenuRoutes).toEqual({HOME:'/',ORGANIZATION:'/organization',EARNINGS:'/bonuses',SHOP:'/shop',ORDERS:'/orders',SUPPORT:'/me'});
  Object.keys(lineRichMenuRoutes).forEach(key=>expect(lineRichMenuTarget(key)).toMatch(/^\/(?!\/)/));
 });
 it('fails closed to Home for unknown or untrusted actions',()=>{
  expect(lineRichMenuTarget('https://example.test')).toBe('/');
  expect(lineRichMenuTarget('UNKNOWN')).toBe('/');
 });
});
