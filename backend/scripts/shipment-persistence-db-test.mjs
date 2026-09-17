import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
let assertions = 0;

const id = () => randomUUID();
const hash = character => character.repeat(64);

async function rejectsInSavepoint(tx, label, statement, expected) {
  const savepoint = `assertion_${assertions}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await tx.$executeRawUnsafe(statement);
    assert.fail(`${label}: operation unexpectedly succeeded`);
  } catch (error) {
    const message = String(error?.message ?? error);
    assert.match(message, expected, `${label}: unexpected database error`);
    assertions += 1;
  } finally {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

try {
  await db.$transaction(async tx => {
    const personId = id();
    const qualificationId = id();
    const orderId = id();
    const connectionId = id();
    const connectionVersionId = id();
    const secondConnectionVersionId = id();
    const fulfillmentId = id();
    const otherFulfillmentId = id();
    const parcelId = id();
    const otherParcelId = id();
    const qcId = id();
    const otherQcId = id();
    const shipmentId = id();
    const otherShipmentId = id();
    const trackingId = id();
    const crossProviderTrackingId = id();
    const transitionId = id();
    const outboxId = id();
    const secondOutboxId = id();
    const claimId = id();

    const setup = `
      INSERT INTO identity.person (person_id, legal_name, status)
      VALUES ('${personId}', 'SHIPMENT DB ASSERTION', 'EFFECTIVE');
      INSERT INTO membership.qualification
        (qualification_id, current_holder_person_id, plan_level_code, status)
      VALUES ('${qualificationId}', '${personId}', 'STARTER', 'EFFECTIVE');
      INSERT INTO commerce."order"
        (order_id, qualification_id, status, gross_amount, net_amount, rule_version_code)
      VALUES ('${orderId}', '${qualificationId}', 'PAID', 1, 1, 'SHIPMENT_DB_ASSERTION');
      INSERT INTO commerce.provider_connection
        (provider_connection_id, domain, provider, connection_key, status, updated_at)
      VALUES ('${connectionId}', 'LOGISTICS', 'TEST_CARRIER', 'SHIPMENT_DB_ASSERTION', 'ACTIVE', now());
      INSERT INTO commerce.provider_connection_version
        (provider_connection_version_id, provider_connection_id, version, environment,
         credential_secret_ref, webhook_verification_ref, config_hash, effective_from, created_by_actor)
      VALUES
        ('${connectionVersionId}', '${connectionId}', 1, 'TEST', 'secret://test/1', 'secret://webhook/1', '${hash('a')}', now(), 'DB_ASSERTION'),
        ('${secondConnectionVersionId}', '${connectionId}', 2, 'TEST', 'secret://test/2', 'secret://webhook/2', '${hash('b')}', now(), 'DB_ASSERTION');
      INSERT INTO commerce.fulfillment
        (fulfillment_id, order_id, fulfillment_key, allocation_snapshot_ref,
         fulfillment_policy_snapshot_ref, updated_at)
      VALUES
        ('${fulfillmentId}', '${orderId}', 'PRIMARY', 'snapshot://allocation/1', 'snapshot://fulfillment-policy/1', now()),
        ('${otherFulfillmentId}', '${orderId}', 'SECONDARY', 'snapshot://allocation/2', 'snapshot://fulfillment-policy/2', now());
      INSERT INTO commerce.fulfillment_parcel
        (fulfillment_parcel_id, fulfillment_id, parcel_key, content_snapshot_ref, package_snapshot_ref)
      VALUES
        ('${parcelId}', '${fulfillmentId}', 'PARCEL-1', 'snapshot://contents/1', 'snapshot://package/1'),
        ('${otherParcelId}', '${otherFulfillmentId}', 'PARCEL-2', 'snapshot://contents/2', 'snapshot://package/2');
      INSERT INTO commerce.fulfillment_qc_evidence
        (fulfillment_qc_evidence_id, fulfillment_id, policy_id, policy_version, policy_snapshot_ref,
         result, checks, inspector_actor, reason, occurred_at, correlation_id)
      VALUES
        ('${qcId}', '${fulfillmentId}', 'QC', '1', 'snapshot://qc-policy/1',
         'PASS', '{"sealed":true}', 'DB_ASSERTION', 'PASSED', now(), '${id()}'),
        ('${otherQcId}', '${otherFulfillmentId}', 'QC', '1', 'snapshot://qc-policy/1',
         'PASS', '{"sealed":true}', 'DB_ASSERTION', 'PASSED', now(), '${id()}');
      INSERT INTO commerce.shipment
        (shipment_id, fulfillment_id, fulfillment_parcel_id, fulfillment_qc_evidence_id,
         provider, connection_id, provider_connection_version_id, carrier, shipping_method,
         recipient_snapshot_ref, pickup_store_snapshot_ref, provider_shipment_ref, updated_at)
      VALUES
        ('${shipmentId}', '${fulfillmentId}', '${parcelId}', '${qcId}', 'TEST_CARRIER',
         'SHIPMENT_DB_ASSERTION', '${connectionVersionId}', 'TEST_CARRIER', 'CVS_PICKUP',
         'snapshot://recipient/1', 'snapshot://store/1', 'PROVIDER-SHIPMENT-1', now()),
        ('${otherShipmentId}', '${fulfillmentId}', '${parcelId}', '${qcId}', 'TEST_CARRIER',
         'SHIPMENT_DB_ASSERTION', '${connectionVersionId}', 'TEST_CARRIER', 'HOME_DELIVERY',
         'snapshot://recipient/2', NULL, 'PROVIDER-SHIPMENT-2', now());
      INSERT INTO commerce.shipment_tracking_event_evidence
        (shipment_tracking_event_evidence_id, shipment_id, provider_connection_version_id,
         provider_event_identity, provider_shipment_ref, raw_status_code, normalized_status,
         mapping_snapshot_ref, payload_hash, safe_evidence_ref, event_time, verified_at, correlation_id)
      VALUES ('${trackingId}', '${shipmentId}', '${connectionVersionId}', 'EVENT-1',
              'PROVIDER-SHIPMENT-1', 'IN_TRANSIT', 'IN_TRANSIT', 'snapshot://mapping/1',
              '${hash('c')}', 'evidence://tracking/1', now(), now(), '${id()}');
      INSERT INTO commerce.shipment_state_transition
        (shipment_state_transition_id, shipment_id, shipment_tracking_event_evidence_id,
         from_status, to_status, business_effect_identity, operation_hash, occurred_at, correlation_id)
      VALUES ('${transitionId}', '${shipmentId}', '${trackingId}', 'PICKED_UP', 'IN_TRANSIT',
              'TRANSITION-1', '${hash('d')}', now(), '${id()}');
      INSERT INTO integration.outbox_event
        (outbox_event_id, event_type, aggregate_type, aggregate_id, payload, correlation_id)
      VALUES
        ('${outboxId}', 'SHIPMENT_CREATED', 'SHIPMENT', '${shipmentId}', '{}', '${id()}'),
        ('${secondOutboxId}', 'SHIPMENT_UPDATED', 'SHIPMENT', '${shipmentId}', '{}', '${id()}');
      INSERT INTO commerce.shipment_operation_claim
        (shipment_operation_claim_id, shipment_id, operation_type, business_effect_identity,
         operation_hash, committed_effect_ref, outbox_event_id)
      VALUES ('${claimId}', '${shipmentId}', 'CREATE_SHIPMENT', 'CLAIM-1', '${hash('e')}',
              'shipment://${shipmentId}', '${outboxId}');
    `;
    for (const statement of setup.split(';').map(value => value.trim()).filter(Boolean)) {
      await tx.$executeRawUnsafe(statement);
    }

    const appendOnly = [
      ['fulfillment parcel', 'commerce.fulfillment_parcel', 'fulfillment_parcel_id', parcelId],
      ['QC evidence', 'commerce.fulfillment_qc_evidence', 'fulfillment_qc_evidence_id', qcId],
      ['tracking evidence', 'commerce.shipment_tracking_event_evidence', 'shipment_tracking_event_evidence_id', trackingId],
      ['state transition', 'commerce.shipment_state_transition', 'shipment_state_transition_id', transitionId],
      ['operation claim', 'commerce.shipment_operation_claim', 'shipment_operation_claim_id', claimId],
    ];
    for (const [label, table, key, value] of appendOnly) {
      await rejectsInSavepoint(tx, `${label} update is append-only`, `UPDATE ${table} SET ${key}='${value}' WHERE ${key}='${value}'`, /append-only table/);
      await rejectsInSavepoint(tx, `${label} delete is append-only`, `DELETE FROM ${table} WHERE ${key}='${value}'`, /append-only table/);
    }

    await rejectsInSavepoint(tx, 'claim business effect is globally idempotent', `
      INSERT INTO commerce.shipment_operation_claim
        (shipment_id, operation_type, business_effect_identity, operation_hash, committed_effect_ref, outbox_event_id)
      VALUES ('${otherShipmentId}', 'CREATE_SHIPMENT', 'CLAIM-1', '${hash('f')}', 'shipment://other', '${secondOutboxId}')
    `, /business_effect_identity/);
    await rejectsInSavepoint(tx, 'one outbox event can back only one claim', `
      INSERT INTO commerce.shipment_operation_claim
        (shipment_id, operation_type, business_effect_identity, operation_hash, committed_effect_ref, outbox_event_id)
      VALUES ('${shipmentId}', 'GET_LABEL', 'CLAIM-2', '${hash('f')}', 'label://other', '${outboxId}')
    `, /outbox_event_id/);
    await rejectsInSavepoint(tx, 'operation hash is unique within shipment', `
      INSERT INTO commerce.shipment_operation_claim
        (shipment_id, operation_type, business_effect_identity, operation_hash, committed_effect_ref, outbox_event_id)
      VALUES ('${shipmentId}', 'GET_LABEL', 'CLAIM-3', '${hash('e')}', 'label://other', '${secondOutboxId}')
    `, /shipment_id, operation_hash/);

    await rejectsInSavepoint(tx, 'provider event identity is unique across shipments for one provider version', `
      INSERT INTO commerce.shipment_tracking_event_evidence
        (shipment_id, provider_connection_version_id, provider_event_identity, provider_shipment_ref,
         raw_status_code, payload_hash, safe_evidence_ref, event_time, verified_at, correlation_id)
      VALUES ('${otherShipmentId}', '${connectionVersionId}', 'EVENT-1', 'PROVIDER-SHIPMENT-2',
              'UNKNOWN', '${hash('1')}', 'evidence://tracking/duplicate', now(), now(), '${id()}')
    `, /provider_connection_version_id, provider_event_identity/);
    await tx.$executeRawUnsafe(`
      INSERT INTO commerce.shipment_tracking_event_evidence
        (shipment_tracking_event_evidence_id, shipment_id, provider_connection_version_id,
         provider_event_identity, provider_shipment_ref, raw_status_code, payload_hash,
         safe_evidence_ref, event_time, verified_at, correlation_id)
      VALUES ('${crossProviderTrackingId}', '${otherShipmentId}', '${secondConnectionVersionId}',
              'EVENT-1', 'PROVIDER-SHIPMENT-2', 'UNKNOWN', '${hash('2')}',
              'evidence://tracking/provider-version-2', now(), now(), '${id()}')
    `);
    assert.equal(await tx.shipmentTrackingEventEvidence.count({ where: { providerEventIdentity: 'EVENT-1' } }), 2);
    assertions += 1;

    await rejectsInSavepoint(tx, 'parcel content snapshot is required', `
      INSERT INTO commerce.fulfillment_parcel (fulfillment_id, parcel_key, content_snapshot_ref, package_snapshot_ref)
      VALUES ('${fulfillmentId}', 'PARCEL-BAD-CONTENT', '   ', 'snapshot://package/2')
    `, /fulfillment_parcel_refs_nonempty_ck/);
    await rejectsInSavepoint(tx, 'parcel package snapshot is required', `
      INSERT INTO commerce.fulfillment_parcel (fulfillment_id, parcel_key, content_snapshot_ref, package_snapshot_ref)
      VALUES ('${fulfillmentId}', 'PARCEL-BAD-PACKAGE', 'snapshot://contents/2', '')
    `, /fulfillment_parcel_refs_nonempty_ck/);
    await rejectsInSavepoint(tx, 'QC policy snapshot is required', `
      INSERT INTO commerce.fulfillment_qc_evidence
        (fulfillment_id, policy_id, policy_version, policy_snapshot_ref, result, checks,
         inspector_actor, reason, occurred_at, correlation_id)
      VALUES ('${fulfillmentId}', 'QC', '2', '', 'PASS', '{}', 'DB_ASSERTION', 'PASSED', now(), '${id()}')
    `, /fulfillment_qc_refs_nonempty_ck/);
    await rejectsInSavepoint(tx, 'QC checks must be an object snapshot', `
      INSERT INTO commerce.fulfillment_qc_evidence
        (fulfillment_id, policy_id, policy_version, policy_snapshot_ref, result, checks,
         inspector_actor, reason, occurred_at, correlation_id)
      VALUES ('${fulfillmentId}', 'QC', '2', 'snapshot://qc-policy/2', 'PASS', '[]',
              'DB_ASSERTION', 'PASSED', now(), '${id()}')
    `, /fulfillment_qc_checks_object_ck/);

    await rejectsInSavepoint(tx, 'CVS shipment fails closed without a store snapshot', `
      INSERT INTO commerce.shipment
        (fulfillment_id, fulfillment_parcel_id, fulfillment_qc_evidence_id, provider, connection_id,
         provider_connection_version_id, carrier, shipping_method, recipient_snapshot_ref,
         pickup_store_snapshot_ref, provider_shipment_ref, updated_at)
      VALUES ('${fulfillmentId}', '${parcelId}', '${qcId}', 'TEST_CARRIER', 'SHIPMENT_DB_ASSERTION',
              '${connectionVersionId}', 'TEST_CARRIER', 'CVS_PICKUP', 'snapshot://recipient/3',
              NULL, 'PROVIDER-SHIPMENT-CVS-NULL', now())
    `, /shipment_pickup_store_ck/);
    await rejectsInSavepoint(tx, 'CVS shipment rejects a blank store snapshot', `
      INSERT INTO commerce.shipment
        (fulfillment_id, fulfillment_parcel_id, fulfillment_qc_evidence_id, provider, connection_id,
         provider_connection_version_id, carrier, shipping_method, recipient_snapshot_ref,
         pickup_store_snapshot_ref, provider_shipment_ref, updated_at)
      VALUES ('${fulfillmentId}', '${parcelId}', '${qcId}', 'TEST_CARRIER', 'SHIPMENT_DB_ASSERTION',
              '${connectionVersionId}', 'TEST_CARRIER', 'CVS_PICKUP', 'snapshot://recipient/4',
              '   ', 'PROVIDER-SHIPMENT-CVS-BLANK', now())
    `, /shipment_pickup_store_ck/);

    await rejectsInSavepoint(tx, 'shipment parcel must belong to the same fulfillment', `
      INSERT INTO commerce.shipment
        (fulfillment_id, fulfillment_parcel_id, fulfillment_qc_evidence_id, provider, connection_id,
         provider_connection_version_id, carrier, shipping_method, recipient_snapshot_ref, updated_at)
      VALUES ('${fulfillmentId}', '${otherParcelId}', '${qcId}', 'TEST_CARRIER', 'SHIPMENT_DB_ASSERTION',
              '${connectionVersionId}', 'TEST_CARRIER', 'HOME_DELIVERY', 'snapshot://recipient/cross-parcel', now())
    `, /shipment_parcel_fulfillment_fk/);
    await rejectsInSavepoint(tx, 'shipment QC evidence must belong to the same fulfillment', `
      INSERT INTO commerce.shipment
        (fulfillment_id, fulfillment_parcel_id, fulfillment_qc_evidence_id, provider, connection_id,
         provider_connection_version_id, carrier, shipping_method, recipient_snapshot_ref, updated_at)
      VALUES ('${fulfillmentId}', '${parcelId}', '${otherQcId}', 'TEST_CARRIER', 'SHIPMENT_DB_ASSERTION',
              '${connectionVersionId}', 'TEST_CARRIER', 'HOME_DELIVERY', 'snapshot://recipient/cross-qc', now())
    `, /shipment_qc_fulfillment_fk/);
    await rejectsInSavepoint(tx, 'shipment provider must match the version connection', `
      UPDATE commerce.shipment SET provider = 'OTHER_CARRIER' WHERE shipment_id = '${shipmentId}'
    `, /shipment provider identity/);
    await rejectsInSavepoint(tx, 'shipment connection id must match the version connection', `
      UPDATE commerce.shipment SET connection_id = 'OTHER_CONNECTION' WHERE shipment_id = '${shipmentId}'
    `, /shipment provider identity/);
    await rejectsInSavepoint(tx, 'shipment provider connection must be logistics domain', `
      UPDATE commerce.provider_connection SET domain = 'PAYMENT' WHERE provider_connection_id = '${connectionId}'
    `, /shipment|provider connection identity/);
    await rejectsInSavepoint(tx, 'referenced provider connection identity cannot drift', `
      UPDATE commerce.provider_connection SET connection_key = 'RENAMED' WHERE provider_connection_id = '${connectionId}'
    `, /provider connection identity/);

    throw new Error('ROLLBACK_SHIPMENT_DB_ASSERTIONS');
  }, { timeout: 30_000 }).catch(error => {
    if (error.message !== 'ROLLBACK_SHIPMENT_DB_ASSERTIONS') throw error;
  });

  console.log(`SHIPMENT_PERSISTENCE_DB_PASS: ${assertions} assertions; all fixtures rolled back`);
} finally {
  await db.$disconnect();
}
