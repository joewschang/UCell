import { createHash } from 'node:crypto';

export type OperationalSeverity = 'INFO'|'WARNING'|'ERROR'|'CRITICAL';
export type StructuredOperationalError = Readonly<{
  event: 'UCELL_STRUCTURED_ERROR'; errorId: string; traceId: string; occurredAt: string;
  environment: string; service: string; releaseVersion: string; severity: OperationalSeverity;
  errorCode: string; errorClass: string; operation: string; retryable: boolean;
  fingerprint: string; message: string;
}>;

const controlled = /^[A-Z][A-Z0-9_]{2,127}$/;

/** Builds a JSON-safe diagnostic event. It never serializes request data, stack traces, or an Error message. */
export function structuredOperationalError(input: {
  service: string; operation: string; traceId?: string; error: unknown; errorCode?: string;
  statusCode?: number; retryable?: boolean; environment?: string; releaseVersion?: string; now?: Date;
}): StructuredOperationalError {
  const status = input.statusCode ?? 500;
  const errorCode = controlled.test(String(input.errorCode ?? ''))
    ? String(input.errorCode)
    : status >= 500 ? 'INTERNAL_UNEXPECTED' : `HTTP_${status}_REQUEST_FAILED`;
  const errorClass = input.error instanceof Error ? input.error.name : typeof input.error;
  const releaseVersion = input.releaseVersion ?? process.env.RELEASE_GIT_HEAD ?? process.env.GITHUB_SHA ?? 'UNVERSIONED';
  const traceId = input.traceId ?? 'TRACE_UNAVAILABLE';
  const fingerprint = createHash('sha256')
    .update([input.service, errorCode, errorClass, input.operation, releaseVersion].join('|'))
    .digest('hex');
  return Object.freeze({
    event: 'UCELL_STRUCTURED_ERROR', errorId: createHash('sha256').update(`${fingerprint}|${traceId}|${Date.now()}`).digest('hex').slice(0, 32),
    traceId, occurredAt: (input.now ?? new Date()).toISOString(), environment: input.environment ?? process.env.UCELL_ENVIRONMENT ?? process.env.NODE_ENV ?? 'UNKNOWN',
    service: input.service, releaseVersion, severity: status >= 500 ? 'ERROR' : 'WARNING', errorCode, errorClass,
    operation: input.operation, retryable: input.retryable ?? status >= 500, fingerprint,
    message: status >= 500 ? 'Unexpected service failure. Use the trace and fingerprint for diagnostics.' : 'Request failed with a controlled domain or transport error.'
  });
}

export function emitStructuredOperationalError(input: Parameters<typeof structuredOperationalError>[0]): StructuredOperationalError {
  const event = structuredOperationalError(input);
  // One JSON line is intentionally suitable for Container Apps/Application Insights ingestion.
  console.error(JSON.stringify(event));
  return event;
}
