/** Server-only adapter for LINE's ID-token verification endpoint.
 * It does not issue sessions, bind identities or install public routes.
 * Channel and expected nonce must originate in trusted server configuration/state.
 */
export type VerifiedLineIdentity = { subject: string; expiresAt: number };
export class LineVerificationError extends Error {
  constructor(code: string) { super(code); this.name = 'LineVerificationError'; }
}
export async function verifyLineIdToken(
  token: unknown,
  config: { channelId: string; expectedNonce?: string },
  dependencies: { fetch?: typeof fetch; now?: () => number } = {},
): Promise<VerifiedLineIdentity> {
  if (typeof config.channelId !== 'string' || !/^\d+$/.test(config.channelId))
    throw new LineVerificationError('LINE_NOT_CONFIGURED');
  if (config.expectedNonce !== undefined && (typeof config.expectedNonce !== 'string' || !config.expectedNonce.trim()))
    throw new LineVerificationError('LINE_NONCE_NOT_CONFIGURED');
  if (typeof token !== 'string' || !token.trim() || token.length > 16384)
    throw new LineVerificationError('LINE_TOKEN_INVALID');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const body = new URLSearchParams({ id_token: token, client_id: config.channelId });
    if (config.expectedNonce !== undefined) body.set('nonce', config.expectedNonce);
    const response = await (dependencies.fetch ?? fetch)('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body, signal: controller.signal, redirect: 'error', cache: 'no-store',
    });
    if (!response.ok) throw new LineVerificationError('LINE_TOKEN_REJECTED');
    const data: unknown = await response.json();
    if (controller.signal.aborted) throw new LineVerificationError('LINE_VERIFICATION_UNAVAILABLE');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new LineVerificationError('LINE_CLAIMS_INVALID');
    const p = data as Record<string, unknown>;
    const now = Math.floor((dependencies.now ?? Date.now)() / 1000);
    if (!Number.isSafeInteger(now) || p.iss !== 'https://access.line.me' || p.aud !== config.channelId ||
        typeof p.sub !== 'string' || !p.sub.trim() ||
        typeof p.exp !== 'number' || !Number.isSafeInteger(p.exp) || p.exp <= now ||
        typeof p.iat !== 'number' || !Number.isSafeInteger(p.iat) || p.iat > now || p.iat > p.exp ||
        (config.expectedNonce !== undefined && p.nonce !== config.expectedNonce))
      throw new LineVerificationError('LINE_CLAIMS_INVALID');
    return { subject: p.sub, expiresAt: p.exp };
  } catch (error) {
    if (controller.signal.aborted) throw new LineVerificationError('LINE_VERIFICATION_UNAVAILABLE');
    if (error instanceof LineVerificationError) throw error;
    // Never expose provider payloads, raw tokens, request body or network errors.
    throw new LineVerificationError('LINE_VERIFICATION_UNAVAILABLE');
  } finally { clearTimeout(timer); }
}
