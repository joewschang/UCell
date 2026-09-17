import {describe,expect,it} from 'vitest';
import {nav} from './nav';

describe('admin navigation terminology',()=>{
  it('uses the approved operational terms without conflating subscriptions, evidence and payout',()=>{
    const labels=Object.fromEntries(nav.map(([label,path])=>[path,label]));
    expect(labels['/subscriptions']).toBe('重購訂閱');
    expect(labels['/bonuses']).toBe('獎金與結算證據');
    expect(labels['/payouts']).toBe('付款批次與對帳');
    expect(Object.values(labels)).not.toContain('重銷方案');
    expect(Object.values(labels)).not.toContain('獎金／帳本');
    expect(Object.values(labels)).not.toContain('結算／付款');
  });
});
