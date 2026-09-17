import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AppShell} from './AppShell';

const auth = vi.hoisted(() => ({role:'CUSTOMER_SERVICE'}));
vi.mock('../features/auth/auth', () => ({useAuth:() => ({user:{name:'Shell test',role:auth.role},logout:vi.fn()})}));
vi.mock('@tanstack/react-query', () => ({useQueryClient:() => ({clear:vi.fn()})}));
afterEach(() => vi.unstubAllGlobals());

describe('grouped navigation access', () => {
  it.each([
    ['CUSTOMER_SERVICE', ['營運中心'], ['/']],
    ['PACKAGE_CONFIG_MANAGE', ['營運中心','商務'], ['/','/packages']],
    ['PACKAGE_CONFIG_APPROVE', ['營運中心','商務'], ['/','/packages']],
    ['MEMBERSHIP_OPS', ['營運中心','會員與資格','組織','分析中心','治理稽核'], ['/', '/people','/applications','/qualifications','/workflows','/organization','/analytics','/documents']],
  ])('renders only allowed links and nonempty groups for %s', (role, groups, paths) => {
    auth.role = role;
    vi.stubGlobal('sessionStorage', {getItem:() => null});
    let renderer!:ReactTestRenderer;
    act(() => {renderer=create(<MemoryRouter initialEntries={['/']}><AppShell/></MemoryRouter>)});
    try {
      const navigation=renderer.root.findByProps({'aria-label':'後台主要功能'});
      expect(navigation.findAllByType('summary').map(node=>node.children.join(''))).toEqual(groups);
      expect(navigation.findAllByType('a').map(node=>node.props.href).sort()).toEqual([...paths].sort());
    } finally {act(() => renderer.unmount())}
  });
});
