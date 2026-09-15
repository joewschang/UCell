import { api } from './api';

/** Matches the backend global EnvelopeInterceptor; DTO validation follows this step. */
export function unwrapMemberEnvelope(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('API 回應格式異常，請稍後重試');
  const envelope = value as Record<string, unknown>;
  const meta = envelope.meta;
  if (!Object.prototype.hasOwnProperty.call(envelope, 'data') || !meta || typeof meta !== 'object' || Array.isArray(meta))
    throw new Error('API 回應格式異常，請稍後重試');
  const fields = meta as Record<string, unknown>;
  if (fields.api_version !== 'v1' || typeof fields.request_id !== 'string' || !fields.request_id.trim() ||
      typeof fields.timestamp !== 'string' || !Number.isFinite(Date.parse(fields.timestamp)))
    throw new Error('API 回應格式異常，請稍後重試');
  // Preserve null, zero, negative adjustments and arrays; never coerce financial data.
  return envelope.data;
}

export async function memberApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return unwrapMemberEnvelope(await api<unknown>(path, init)) as T;
}
