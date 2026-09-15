import { afterEach, expect, it, vi } from 'vitest';
const liff = vi.hoisted(() => ({ init: vi.fn(), isLoggedIn: vi.fn(), login: vi.fn() }));
vi.mock('@line/liff', () => ({ default: liff }));
import { initLiff } from '../src/liff';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('requires an explicit mock flag', async () => {
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_LIFF_ID', '');
    await expect(initLiff()).rejects.toThrow('尚未設定');
    expect(liff.init).not.toHaveBeenCalled();
});
it('does not trust a LINE login as a UCell session', async () => {
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_LIFF_ID', 'test-id');
    liff.isLoggedIn.mockReturnValue(true);
    await expect(initLiff()).rejects.toThrow('串接中');
});
it('keeps redirect separate from an authenticated result', async () => {
    vi.stubGlobal('sessionStorage', { removeItem: vi.fn() });
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    vi.stubEnv('VITE_LIFF_ID', 'test-id');
    liff.isLoggedIn.mockReturnValue(false);
    await expect(initLiff()).resolves.toEqual({ mode: 'redirect' });
    expect(liff.login).toHaveBeenCalledTimes(1);
});
