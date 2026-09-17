import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { Prisma, PrismaService } from '@ucell/database';

interface UatEvidenceInput {
  classification: 'LOCAL_ASSISTIVE_ONLY' | 'FORMAL_UAT_EVIDENCE';
  environment: string;
  scenarioCode: string;
  result: 'PASS' | 'FAIL' | 'BLOCKED';
  evidenceHash: string;
  artifactReference: string;
  approvalReference?: string;
  executedAt: string;
}

@Injectable()
export class UatEvidenceService {
  constructor(
    private readonly db: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async record(input: UatEvidenceInput, idempotencyKey: string, actorId: string | undefined, requestId: string, correlationId: string) {
    if (!actorId) throw new ForbiddenException({ code: 'UAT_EVIDENCE_ACTOR_REQUIRED', message: 'A governed admin actor is required.' });
    const environment = input.environment.trim().toUpperCase();
    const scenarioCode = input.scenarioCode.trim();
    const artifactReference = input.artifactReference.trim();
    const approvalReference = input.approvalReference?.trim();
    const executedAt = new Date(input.executedAt);

    if (!scenarioCode || !artifactReference || !Number.isFinite(executedAt.getTime())) {
      throw new UnprocessableEntityException({ code: 'UAT_EVIDENCE_INVALID', message: 'Scenario, artifact reference, and execution timestamp are required.' });
    }
    if (executedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new UnprocessableEntityException({ code: 'UAT_EVIDENCE_FUTURE_TIMESTAMP', message: 'Execution timestamp cannot be in the future.' });
    }
    if (input.classification === 'FORMAL_UAT_EVIDENCE') {
      if (this.config.get<string>('UAT_FORMAL_EVIDENCE_INGESTION_ENABLED') !== 'true') {
        throw new ForbiddenException({ code: 'FORMAL_UAT_EVIDENCE_DISABLED', message: 'Formal UAT evidence ingestion is not enabled for this environment.' });
      }
      if (this.config.get<string>('UCELL_DEPLOYMENT_ENV') !== 'UAT') {
        throw new ForbiddenException({ code: 'FORMAL_UAT_DEPLOYMENT_REQUIRED', message: 'Formal UAT evidence ingestion is restricted to the governed UAT deployment.' });
      }
      if (environment !== 'UAT') {
        throw new UnprocessableEntityException({ code: 'FORMAL_UAT_ENVIRONMENT_REQUIRED', message: 'Formal UAT evidence may only be recorded in the UAT environment.' });
      }
      if (!approvalReference) {
        throw new UnprocessableEntityException({ code: 'UAT_APPROVAL_REFERENCE_REQUIRED', message: 'Formal UAT evidence requires an approval reference.' });
      }
    }

    const command = { ...input, environment, scenarioCode, artifactReference, approvalReference: approvalReference ?? null };
    const result = await this.idempotency.execute(`admin:uat-evidence:record:${actorId}`, idempotencyKey, command, async tx => {
      const evidenceId = randomUUID();
      const [evidence] = await tx.$queryRaw<Array<any>>(Prisma.sql`
        INSERT INTO audit.uat_execution_evidence
          (uat_execution_evidence_id, classification, environment, scenario_code, result,
           evidence_hash, artifact_reference, approval_reference, actor_id, executed_at,
           request_id, correlation_id)
        VALUES
          (${evidenceId}::uuid, ${input.classification}::audit."UatEvidenceClassification", ${environment}, ${scenarioCode},
           ${input.result}::audit."UatEvidenceResult", ${input.evidenceHash}, ${artifactReference}, ${approvalReference ?? null},
           ${actorId}::uuid, ${executedAt}, ${requestId}, ${correlationId}::uuid)
        RETURNING uat_execution_evidence_id AS "uatExecutionEvidenceId", classification, environment,
          scenario_code AS "scenarioCode", result, evidence_hash AS "evidenceHash",
          artifact_reference AS "artifactReference", approval_reference AS "approvalReference",
          actor_id AS "actorId", executed_at AS "executedAt", recorded_at AS "recordedAt"
      `);
      await this.audit.write(tx, {
        actorType: 'ADMIN', actorId,
        action: 'UAT_EXECUTION_EVIDENCE_RECORDED', entityType: 'UatExecutionEvidence',
        entityId: evidence.uatExecutionEvidenceId,
        afterData: { classification: evidence.classification, environment, scenarioCode, result: input.result, evidenceHash: input.evidenceHash, artifactReference },
        requestId, correlationId,
      });
      return evidence;
    });
    return { ...result.value, replayed: result.replayed, formalSignOff: false };
  }

  async list(filter: { environment?: string; scenarioCode?: string }) {
    const environment = filter.environment?.trim().toUpperCase() || null;
    const scenarioCode = filter.scenarioCode?.trim() || null;
    const rows = await this.db.$queryRaw<Array<any>>(Prisma.sql`
      SELECT uat_execution_evidence_id AS "uatExecutionEvidenceId", classification, environment,
        scenario_code AS "scenarioCode", result, evidence_hash AS "evidenceHash",
        artifact_reference AS "artifactReference", approval_reference AS "approvalReference",
        actor_id AS "actorId", executed_at AS "executedAt", recorded_at AS "recordedAt"
      FROM audit.uat_execution_evidence
      WHERE (${environment}::text IS NULL OR environment = ${environment})
        AND (${scenarioCode}::text IS NULL OR scenario_code = ${scenarioCode})
      ORDER BY recorded_at DESC LIMIT 500
    `);
    return rows.map(row => ({ ...row, formalSignOff: false }));
  }
}
