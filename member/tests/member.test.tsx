import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResource } from '../src/useResource';
import { QualificationProvider } from '../src/QualificationContext';
import App from '../src/App';
import { api } from '../src/api';
import { getDashboard, getPerformance } from '../src/memberData';
let renderer: ReactTestRenderer;
const memory = new Map<string, string>();
const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
beforeEach(() => { memory.clear(); vi.stubGlobal('sessionStorage', storage); });
afterEach(() => { if (renderer)
    act(() => renderer.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const q = { id: 'q1', code: 'Q1', rank: 'ELITE', active: true, ballLabel: '球1' };
function Probe({ id, load }: {
    id: string;
    load: (s: AbortSignal) => Promise<string>;
}) { const state = useResource(id, load); return <p>{state.error ?? state.data ?? 'loading'}</p>; }
it('ignores slow results after qualification switch', async () => {
    let first!: (v: string) => void;
    await act(async () => { renderer = create(<Probe id="q1" load={() => new Promise(r => { first = r; })}/>); });
    await act(async () => { renderer.update(<Probe id="q2" load={async () => 'ball 2'}/>); });
    await act(async () => first('ball 1'));
    expect(renderer.root.findByType('p').children).toEqual(['ball 2']);
});
it('clears the previous month while next month loads', async () => {
    await act(async () => { renderer = create(<Probe id="q1:2026-08" load={async () => 'August'}/>); });
    await act(async () => renderer.update(<Probe id="q1:2026-09" load={() => new Promise(() => { })}/>));
    expect(renderer.root.findByType('p').children).toEqual(['loading']);
});
it('reports failed resource requests', async () => {
    await act(async () => { renderer = create(<Probe id="failure" load={async () => { throw Error('unavailable'); }}/>); });
    expect(renderer.root.findByType('p').children).toEqual(['unavailable']);
});
it('does not expose stale data after API errors', async () => {
    await act(async () => { renderer = create(<Probe id="first" load={async () => 'old'}/>); });
    await act(async () => renderer.update(<Probe id="second" load={async () => { throw Error('denied'); }}/>));
    expect(renderer.root.findByType('p').children).toEqual(['denied']);
});
it('discards an expired token on 401', async () => {
    storage.setItem('ucell_member_token', 'expired');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(api('/member/me')).rejects.toThrow('登入已失效');
    expect(storage.getItem('ucell_member_token')).toBeNull();
});
it('rejects forbidden access without substituting mock data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    await expect(api('/member/me')).rejects.toThrow('無權');
});
it('rejects a dashboard belonging to another qualification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ qualification: { id: 'q2' } }))));
    await expect(getDashboard(q, new AbortController().signal)).rejects.toThrow('資格不符');
});
it('rejects a performance response for another period', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ qualificationId: 'q1', period: '2026-08' }))));
    await expect(getPerformance(q, '2026-09', new AbortController().signal)).rejects.toThrow('期間不符');
});
async function mount(path = '/') {
    await act(async () => { renderer = create(<MemoryRouter initialEntries={[path]}><QualificationProvider><App /></QualificationProvider></MemoryRouter>); });
}
function fakeAPI() {
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
        if (input.includes('/qualifications'))
            return new Response(JSON.stringify([q, { ...q, id: 'q2', code: 'Q2' }]));
        if (input.includes('/dashboard'))
            return new Response(JSON.stringify({ memberName: 'Member', memberNo: 'M1', qualification: q, monthlyRepurchaseStatus: 'PENDING', pv: null, rpv: null, epv: null, bonusAmount: null, bonusStatus: 'PENDING' }));
        return new Response('[]');
    }));
}
it('replaces a saved qualification no longer owned by the member', async () => {
    storage.setItem('ucell_qualification_id', 'foreign');
    fakeAPI();
    await mount();
    expect(renderer.root.findByType('select').props.value).toBe('q1');
    expect(storage.getItem('ucell_qualification_id')).toBe('q1');
});
it('rejects tampered qualification selection', async () => {
    fakeAPI();
    await mount();
    await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'foreign' } }));
    expect(renderer.root.findByType('select').props.value).toBe('q1');
});
it('shows pending values without inventing zero awards', async () => {
    fakeAPI();
    await mount();
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain('結算中');
    expect(text).not.toContain('NT$ 0');
});
it('handles members with no qualifications without loading scoped data', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('[]'));
    vi.stubGlobal('fetch', fetch);
    await mount();
    expect(JSON.stringify(renderer.toJSON())).toContain('尚未取得會員資格');
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('renders a useful not-found page', async () => {
    fakeAPI();
    await mount('/unknown');
    expect(JSON.stringify(renderer.toJSON())).toContain('找不到頁面');
});
