/** Server session authentication only; qualification ownership is a separate check. */
export type MemberPrincipal = {
  sessionId: string;
  personId: string;
  provider: 'LINE';
  subject: string;
};

export class MemberAuthenticationError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'MemberAuthenticationError';
  }
}

type Dependencies = {
  authenticate: (token: string) => Promise<unknown>;
  resolveLineSubject: (subject: string) => Promise<unknown>;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.trim() === value;

export async function authenticateMemberRequest(
  request: { headers?: { authorization?: unknown }; user?: unknown },
  dependencies: Dependencies,
): Promise<MemberPrincipal> {
  // Never retain a principal supplied by earlier middleware on a failed request.
  delete request.user;
  const header = request.headers?.authorization;
  const match = typeof header === 'string' && header.length <= 8192
    ? /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i.exec(header) : null;
  if (!match || match[0] !== header) throw new MemberAuthenticationError('MEMBER_BEARER_REQUIRED');

  let session: unknown;
  try {
    // Existing session service owns token hashing, expiry and revoked-state checks.
    session = await dependencies.authenticate(match[1]);
  } catch {
    throw new MemberAuthenticationError('MEMBER_SESSION_INVALID');
  }
  if (!record(session) || session.provider !== 'LINE' || session.role != null ||
      !nonempty(session.sessionId) || !nonempty(session.personId) || !nonempty(session.subject)) {
    throw new MemberAuthenticationError('MEMBER_SESSION_INVALID');
  }

  let binding: unknown;
  try {
    binding = await dependencies.resolveLineSubject(session.subject);
  } catch {
    throw new MemberAuthenticationError('MEMBER_IDENTITY_UNAVAILABLE');
  }
  if (!record(binding) || binding.provider !== 'LINE' ||
      binding.providerSubject !== session.subject || binding.personId !== session.personId) {
    throw new MemberAuthenticationError('MEMBER_IDENTITY_MISMATCH');
  }
  const principal: MemberPrincipal = {
    sessionId: session.sessionId, personId: session.personId,
    provider: 'LINE', subject: session.subject,
  };
  request.user = principal;
  return principal;
}
