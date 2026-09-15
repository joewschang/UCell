import liff from '@line/liff';
/** Session exchange contract is not present in this backend branch. Fail closed. */
export async function initLiff() {
    // Remove raw credentials persisted by the previous prototype.
    sessionStorage.removeItem('ucell_line_id_token');
    if (import.meta.env.VITE_ENABLE_MOCK === 'true')
        return { mode: 'mock' as const };
    const id = import.meta.env.VITE_LIFF_ID;
    if (!id)
        throw new Error('LINE 登入尚未設定，請聯絡客服');
    await liff.init({ liffId: id });
    if (!liff.isLoggedIn()) {
        liff.login();
        return { mode: 'redirect' as const };
    }
    // Do not treat a client profile or cached bearer as a verified UCell session.
    throw new Error('會員登入服務串接中，暫時無法開啟真實會員資料');
}
let boot: ReturnType<typeof initLiff> | undefined;
export function bootstrapLiff() { return boot ??= initLiff().catch(error => { boot = undefined; throw error; }); }
