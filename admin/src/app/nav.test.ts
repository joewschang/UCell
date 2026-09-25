import {describe,expect,it} from 'vitest';
import {nav,navGroups} from './nav';

describe('admin navigation terminology',()=>{
  it('places every existing route in exactly one of the eight approved groups',()=>{
    expect(navGroups.map(group=>group.label)).toEqual(['Dashboard','會員管理','組織管理','商務','獎金中心','財務／治理','營運分析','系統治理']);
    const paths=navGroups.flatMap(group=>group.paths);
    expect(paths.sort()).toEqual(nav.map(([,path])=>path).sort());
    expect(new Set(paths).size).toBe(paths.length);
  });
  it('uses the approved operational terms without conflating subscriptions, evidence and payout',()=>{
    const labels=Object.fromEntries(nav.map(([label,path])=>[path,label]));
    expect(labels['/subscriptions']).toBe('重購訂閱');
    expect(labels['/bonuses']).toBe('獎金與結算證據');
    expect(labels['/payouts']).toBe('付款批次與對帳');
    expect(Object.values(labels)).not.toContain('重銷方案');
    expect(Object.values(labels)).not.toContain('獎金／帳本');
    expect(Object.values(labels)).not.toContain('結算／付款');
    expect(labels['/provider-operations']).toBe('Provider Webhook 營運');
  });
});
