import React from 'react';
import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';

vi.mock('./auth',()=>({
  useAuth:()=>({user:{name:'Membership Operator',role:'MEMBERSHIP_OPS'}}),
}));

import {RequirePageRole} from './RequirePageRole';

describe('RequirePageRole',()=>{
  it('renders an explicit 403 at the requested URL instead of silently redirecting',()=>{
    const html=renderToStaticMarkup(
      <MemoryRouter initialEntries={['/payouts']}>
        <RequirePageRole><p>restricted payout data</p></RequirePageRole>
      </MemoryRouter>,
    );
    expect(html).toContain('403 · 權限不足');
    expect(html).toContain('MEMBERSHIP_OPS');
    expect(html).toContain('/payouts');
    expect(html).toContain('返回營運總覽');
    expect(html).not.toContain('restricted payout data');
  });

  it('renders authorized page content unchanged',()=>{
    const html=renderToStaticMarkup(
      <MemoryRouter initialEntries={['/people']}>
        <RequirePageRole><p>authorized people data</p></RequirePageRole>
      </MemoryRouter>,
    );
    expect(html).toContain('authorized people data');
    expect(html).not.toContain('403 · 權限不足');
  });
});
