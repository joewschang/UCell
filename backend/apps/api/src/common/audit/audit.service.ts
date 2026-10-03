import { Injectable } from '@nestjs/common';
import { Prisma } from '@ucell/database';
import { createHash } from 'node:crypto';

const SENSITIVE_KEY = /(?:password|token|secret|authorization|cookie|email|phone|mobile|legalname|name|address|bank|document)/i;

type SafeJson = Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;
function sanitize(value: unknown, key = ''): SafeJson | undefined {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null) return Prisma.JsonNull;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => sanitize(item) ?? null) as Prisma.InputJsonValue;
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, sanitize(child, childKey) ?? null])) as Prisma.InputJsonValue;
  }
  return undefined;
}
function digest(value: SafeJson | undefined): string | undefined {
  return value === undefined ? undefined : createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

@Injectable()
export class AuditService {
  async write(
    tx: Prisma.TransactionClient,
    input: {
      actorType: string; actorId?: string; actorRoleSnapshot?: string;
      action: string; eventCode?: string; entityType: string; entityId?: string;
      result?: 'SUCCESS'|'DENIED'|'FAILED'; severity?: 'INFO'|'WARNING'|'ERROR'|'CRITICAL';
      privacyClass?: string; retentionClass?: string; evidenceRef?: string;
      beforeData?: unknown; afterData?: unknown; reasonCode?: string;
      requestId: string; correlationId: string;
    },
  ) {
    const beforeData = sanitize(input.beforeData);
    const afterData = sanitize(input.afterData);
    const changedFieldNames = [...new Set([
      ...Object.keys((beforeData && typeof beforeData === 'object' && !Array.isArray(beforeData) ? beforeData : {}) as object),
      ...Object.keys((afterData && typeof afterData === 'object' && !Array.isArray(afterData) ? afterData : {}) as object),
    ])].sort();
    return tx.auditEvent.create({
      data: {
        actorType: input.actorType, actorId: input.actorId, actorRoleSnapshot: input.actorRoleSnapshot,
        action: input.action, eventCode: input.eventCode ?? input.action,
        environment: process.env.UCELL_ENVIRONMENT ?? process.env.NODE_ENV ?? 'UNKNOWN', traceId: input.correlationId,
        entityType: input.entityType, entityId: input.entityId,
        result: input.result ?? 'SUCCESS', severity: input.severity ?? 'INFO',
        privacyClass: input.privacyClass ?? 'INTERNAL', retentionClass: input.retentionClass ?? 'STANDARD',
        beforeData: beforeData ?? Prisma.DbNull, afterData: afterData ?? Prisma.DbNull,
        changedFieldNames, beforeHash: digest(beforeData), afterHash: digest(afterData),
        reasonCode: input.reasonCode, evidenceRef: input.evidenceRef,
        requestId: input.requestId, correlationId: input.correlationId,
      },
    });
  }
}
