import { unwrapMemberEnvelope } from '../src/memberApi';
import * as dto from '../src/validation';

export const endpoints = {
  qualifications: { path: '/member/qualifications', parse: dto.parseQualifications },
  person: { path: '/member/me', parse: dto.parsePerson },
  dashboard: { path: '/member/dashboard', parse: dto.parseDashboard },
  organization: { path: '/member/organization/sponsor', parse: dto.parseOrganization },
  binary: { path: '/member/organization/binary', parse: dto.parseBinary },
  performance: { path: '/member/performance', parse: dto.parsePerformance },
  bonuses: { path: '/member/bonuses', parse: dto.parseBonus },
  ledger: { path: '/member/bonuses/ledger', parse: dto.parseLedger },
  products: { path: '/member/products', parse: dto.parseProducts },
  orders: { path: '/member/orders', parse: dto.parseOrders },
} as const;
type Key = keyof typeof endpoints;
const scoped = new Set<Key>(['organization', 'binary', 'performance', 'bonuses', 'ledger', 'orders']);
const periodic = new Set<Key>(['performance', 'bonuses', 'ledger']);
export function verifyBundle(input: unknown): { endpoint: string; passed: boolean }[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Contract bundle must be an object');
  const bundle = input as Record<string, unknown>;
  if (typeof bundle.qualificationId !== 'string' || !bundle.qualificationId.trim() ||
      typeof bundle.period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(bundle.period) ||
      !bundle.responses || typeof bundle.responses !== 'object' || Array.isArray(bundle.responses))
    throw Error('Contract bundle requires qualificationId, period and responses');
  const responses = bundle.responses as Record<string, unknown>;
  // A qualification supplied in the bundle must also belong to its returned list.
  let owned = false;
  try { owned = dto.parseQualifications(unwrapMemberEnvelope(responses.qualifications)).some(q => q.id === bundle.qualificationId); } catch { /* Report through endpoint results. */ }
  return (Object.keys(endpoints) as Key[]).map(key => {
    try {
      const value = endpoints[key].parse(unwrapMemberEnvelope(responses[key]));
      if (key === 'qualifications' && !owned) throw Error('scope');
      if ((scoped.has(key) || key === 'dashboard') && !owned) throw Error('scope');
      if (key === 'dashboard' && (value as { qualification: { id: string } }).qualification.id !== bundle.qualificationId) throw Error('scope');
      if (scoped.has(key) && (value as { qualificationId: string }).qualificationId !== bundle.qualificationId) throw Error('scope');
      if (periodic.has(key) && (value as { period: string }).period !== bundle.period) throw Error('period');
      return { endpoint: endpoints[key].path, passed: true };
    } catch {
      // Output never includes response bodies, member details, tokens or raw errors.
      return { endpoint: endpoints[key].path, passed: false };
    }
  });
}
