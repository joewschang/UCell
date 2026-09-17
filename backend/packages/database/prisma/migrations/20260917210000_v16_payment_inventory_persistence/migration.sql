-- CreateEnum
CREATE TYPE "commerce"."CanonicalPaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'PAID', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "commerce"."PaymentAttemptStatus" AS ENUM ('REQUESTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "commerce"."InventoryTrackingMode" AS ENUM ('NONE', 'LOT', 'SERIAL', 'LOT_SERIAL');

-- CreateEnum
CREATE TYPE "commerce"."InventoryReservationStatus" AS ENUM ('RESERVED', 'PARTIALLY_RELEASED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "commerce"."InventoryMovementType" AS ENUM ('RECEIPT', 'RESERVE', 'RELEASE', 'PICK', 'SHIP', 'RETURN', 'ADJUST');

-- CreateEnum
CREATE TYPE "commerce"."InventoryOperationType" AS ENUM ('RESERVE', 'RELEASE');

-- CreateTable
CREATE TABLE "commerce"."payment" (
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "status" "commerce"."CanonicalPaymentStatus" NOT NULL DEFAULT 'CREATED',
    "provider_transaction_ref" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "commerce"."payment_attempt" (
    "payment_attempt_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "provider_request_ref" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "operation_hash" TEXT NOT NULL,
    "status" "commerce"."PaymentAttemptStatus" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "safe_response_ref" TEXT,

    CONSTRAINT "payment_attempt_pkey" PRIMARY KEY ("payment_attempt_id")
);

-- CreateTable
CREATE TABLE "commerce"."payment_provider_event_evidence" (
    "payment_provider_event_evidence_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "provider_event_identity" TEXT NOT NULL,
    "provider_transaction_ref" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "safe_evidence_ref" TEXT NOT NULL,
    "verification_config_version" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" UUID NOT NULL,

    CONSTRAINT "payment_provider_event_evidence_pkey" PRIMARY KEY ("payment_provider_event_evidence_id")
);

-- CreateTable
CREATE TABLE "commerce"."payment_state_transition" (
    "payment_state_transition_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "payment_provider_event_evidence_id" UUID NOT NULL,
    "from_status" "commerce"."CanonicalPaymentStatus" NOT NULL,
    "to_status" "commerce"."CanonicalPaymentStatus" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "business_effect_identity" TEXT NOT NULL,
    "operation_hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" UUID NOT NULL,

    CONSTRAINT "payment_state_transition_pkey" PRIMARY KEY ("payment_state_transition_id")
);

-- CreateTable
CREATE TABLE "commerce"."payment_operation_claim" (
    "payment_operation_claim_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "business_effect_identity" TEXT NOT NULL,
    "operation_hash" TEXT NOT NULL,
    "committed_effect_ref" TEXT NOT NULL,
    "payment_state_transition_id" UUID NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "committed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_operation_claim_pkey" PRIMARY KEY ("payment_operation_claim_id")
);

-- CreateTable
CREATE TABLE "commerce"."warehouse" (
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "membership"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "address_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("warehouse_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_item" (
    "inventory_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "tracking_mode" "commerce"."InventoryTrackingMode" NOT NULL DEFAULT 'NONE',
    "status" "membership"."RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("inventory_item_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_balance" (
    "warehouse_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_balance_pkey" PRIMARY KEY ("warehouse_id","inventory_item_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_reservation" (
    "inventory_reservation_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "source_effect_key" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "status" "commerce"."InventoryReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_reservation_pkey" PRIMARY KEY ("inventory_reservation_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_reservation_line" (
    "inventory_reservation_line_id" UUID NOT NULL,
    "inventory_reservation_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "released_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_reservation_line_pkey" PRIMARY KEY ("inventory_reservation_line_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_movement" (
    "inventory_movement_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "operation_claim_id" UUID,
    "movement_type" "commerce"."InventoryMovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "on_hand_delta" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reserved_delta" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_line_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" UUID NOT NULL,

    CONSTRAINT "inventory_movement_pkey" PRIMARY KEY ("inventory_movement_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_balance_evidence" (
    "inventory_balance_evidence_id" UUID NOT NULL,
    "operation_claim_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "inventory_item_id" UUID NOT NULL,
    "before_on_hand" DECIMAL(18,4) NOT NULL,
    "before_reserved" DECIMAL(18,4) NOT NULL,
    "after_on_hand" DECIMAL(18,4) NOT NULL,
    "after_reserved" DECIMAL(18,4) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_balance_evidence_pkey" PRIMARY KEY ("inventory_balance_evidence_id")
);

-- CreateTable
CREATE TABLE "commerce"."inventory_operation_claim" (
    "inventory_operation_claim_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "operation_type" "commerce"."InventoryOperationType" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "operation_hash" TEXT NOT NULL,
    "result_hash" TEXT NOT NULL,
    "result_snapshot" JSONB NOT NULL,
    "outbox_event_id" UUID NOT NULL,
    "committed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_operation_claim_pkey" PRIMARY KEY ("inventory_operation_claim_id")
);

-- CreateIndex
CREATE INDEX "payment_order_id_created_at_idx" ON "commerce"."payment"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_status_created_at_idx" ON "commerce"."payment"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_connection_id_provider_transaction_ref_key" ON "commerce"."payment"("provider", "connection_id", "provider_transaction_ref");

-- CreateIndex
CREATE INDEX "payment_attempt_status_requested_at_idx" ON "commerce"."payment_attempt"("status", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempt_payment_id_attempt_no_key" ON "commerce"."payment_attempt"("payment_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempt_payment_id_idempotency_key_key" ON "commerce"."payment_attempt"("payment_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payment_provider_event_evidence_payment_id_received_at_idx" ON "commerce"."payment_provider_event_evidence"("payment_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_event_evidence_provider_connection_id_prov_key" ON "commerce"."payment_provider_event_evidence"("provider", "connection_id", "provider_event_identity");

-- CreateIndex
CREATE INDEX "payment_state_transition_payment_id_recorded_at_idx" ON "commerce"."payment_state_transition"("payment_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_state_transition_payment_id_business_effect_identit_key" ON "commerce"."payment_state_transition"("payment_id", "business_effect_identity");

-- CreateIndex
CREATE UNIQUE INDEX "payment_state_transition_payment_provider_event_evidence_id_key" ON "commerce"."payment_state_transition"("payment_provider_event_evidence_id", "operation_hash");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operation_claim_business_effect_identity_key" ON "commerce"."payment_operation_claim"("business_effect_identity");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operation_claim_payment_state_transition_id_key" ON "commerce"."payment_operation_claim"("payment_state_transition_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operation_claim_outbox_event_id_key" ON "commerce"."payment_operation_claim"("outbox_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_operation_claim_payment_id_operation_hash_key" ON "commerce"."payment_operation_claim"("payment_id", "operation_hash");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_code_key" ON "commerce"."warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_sku_key" ON "commerce"."inventory_item"("sku");

-- CreateIndex
CREATE INDEX "inventory_item_product_id_status_idx" ON "commerce"."inventory_item"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservation_source_effect_key_key" ON "commerce"."inventory_reservation"("source_effect_key");

-- CreateIndex
CREATE INDEX "inventory_reservation_order_id_status_idx" ON "commerce"."inventory_reservation"("order_id", "status");

-- CreateIndex
CREATE INDEX "inventory_reservation_warehouse_id_status_idx" ON "commerce"."inventory_reservation"("warehouse_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservation_line_inventory_reservation_id_order_l_key" ON "commerce"."inventory_reservation_line"("inventory_reservation_id", "order_line_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movement_idempotency_key_key" ON "commerce"."inventory_movement"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_movement_warehouse_id_inventory_item_id_occurred__idx" ON "commerce"."inventory_movement"("warehouse_id", "inventory_item_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_movement_source_type_source_id_idx" ON "commerce"."inventory_movement"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balance_evidence_operation_claim_id_inventory_ite_key" ON "commerce"."inventory_balance_evidence"("operation_claim_id", "inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operation_claim_idempotency_key_key" ON "commerce"."inventory_operation_claim"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operation_claim_outbox_event_id_key" ON "commerce"."inventory_operation_claim"("outbox_event_id");

-- CreateIndex
CREATE INDEX "inventory_operation_claim_source_type_source_id_idx" ON "commerce"."inventory_operation_claim"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_operation_claim_warehouse_id_operation_hash_key" ON "commerce"."inventory_operation_claim"("warehouse_id", "operation_hash");
-- AddForeignKey
ALTER TABLE "commerce"."payment" ADD CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce"."order"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_attempt" ADD CONSTRAINT "payment_attempt_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "commerce"."payment"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_provider_event_evidence" ADD CONSTRAINT "payment_provider_event_evidence_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "commerce"."payment"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_state_transition" ADD CONSTRAINT "payment_state_transition_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "commerce"."payment"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_state_transition" ADD CONSTRAINT "payment_state_transition_payment_provider_event_evidence_i_fkey" FOREIGN KEY ("payment_provider_event_evidence_id") REFERENCES "commerce"."payment_provider_event_evidence"("payment_provider_event_evidence_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_operation_claim" ADD CONSTRAINT "payment_operation_claim_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "commerce"."payment"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_operation_claim" ADD CONSTRAINT "payment_operation_claim_payment_state_transition_id_fkey" FOREIGN KEY ("payment_state_transition_id") REFERENCES "commerce"."payment_state_transition"("payment_state_transition_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."payment_operation_claim" ADD CONSTRAINT "payment_operation_claim_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "integration"."outbox_event"("outbox_event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_item" ADD CONSTRAINT "inventory_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "commerce"."product_reference"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_balance" ADD CONSTRAINT "inventory_balance_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "commerce"."warehouse"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_balance" ADD CONSTRAINT "inventory_balance_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "commerce"."inventory_item"("inventory_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_reservation" ADD CONSTRAINT "inventory_reservation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "commerce"."order"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_reservation" ADD CONSTRAINT "inventory_reservation_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "commerce"."warehouse"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_reservation_line" ADD CONSTRAINT "inventory_reservation_line_inventory_reservation_id_fkey" FOREIGN KEY ("inventory_reservation_id") REFERENCES "commerce"."inventory_reservation"("inventory_reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_reservation_line" ADD CONSTRAINT "inventory_reservation_line_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "commerce"."order_line"("order_line_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_reservation_line" ADD CONSTRAINT "inventory_reservation_line_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "commerce"."inventory_item"("inventory_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_movement" ADD CONSTRAINT "inventory_movement_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "commerce"."warehouse"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_movement" ADD CONSTRAINT "inventory_movement_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "commerce"."inventory_item"("inventory_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_movement" ADD CONSTRAINT "inventory_movement_operation_claim_id_fkey" FOREIGN KEY ("operation_claim_id") REFERENCES "commerce"."inventory_operation_claim"("inventory_operation_claim_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_balance_evidence" ADD CONSTRAINT "inventory_balance_evidence_operation_claim_id_fkey" FOREIGN KEY ("operation_claim_id") REFERENCES "commerce"."inventory_operation_claim"("inventory_operation_claim_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_balance_evidence" ADD CONSTRAINT "inventory_balance_evidence_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "commerce"."warehouse"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_balance_evidence" ADD CONSTRAINT "inventory_balance_evidence_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "commerce"."inventory_item"("inventory_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_operation_claim" ADD CONSTRAINT "inventory_operation_claim_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "commerce"."warehouse"("warehouse_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commerce"."inventory_operation_claim" ADD CONSTRAINT "inventory_operation_claim_outbox_event_id_fkey" FOREIGN KEY ("outbox_event_id") REFERENCES "integration"."outbox_event"("outbox_event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express these deterministic integrity constraints.
ALTER TABLE commerce.payment
  ADD CONSTRAINT payment_amount_nonnegative CHECK (amount >= 0),
  ADD CONSTRAINT payment_currency_iso CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE commerce.payment_attempt
  ADD CONSTRAINT payment_attempt_number_positive CHECK (attempt_no > 0),
  ADD CONSTRAINT payment_attempt_hash_format CHECK (operation_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE commerce.payment_provider_event_evidence
  ADD CONSTRAINT payment_provider_event_payload_hash_format CHECK (payload_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE commerce.payment_state_transition
  ADD CONSTRAINT payment_state_transition_amount_nonnegative CHECK (amount >= 0),
  ADD CONSTRAINT payment_state_transition_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT payment_state_transition_operation_hash_format CHECK (operation_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE commerce.payment_operation_claim
  ADD CONSTRAINT payment_operation_claim_hash_format CHECK (operation_hash ~ '^[a-f0-9]{64}$');

ALTER TABLE commerce.inventory_balance
  ADD CONSTRAINT inventory_balance_nonnegative CHECK (on_hand >= 0 AND reserved >= 0),
  ADD CONSTRAINT inventory_balance_available_nonnegative CHECK (on_hand >= reserved),
  ADD CONSTRAINT inventory_balance_version_nonnegative CHECK (version >= 0);
ALTER TABLE commerce.inventory_reservation_line
  ADD CONSTRAINT inventory_reservation_line_quantity_positive CHECK (quantity > 0),
  ADD CONSTRAINT inventory_reservation_line_release_range CHECK (released_quantity >= 0 AND released_quantity <= quantity);
ALTER TABLE commerce.inventory_movement
  ADD CONSTRAINT inventory_movement_quantity_positive CHECK (quantity > 0);
ALTER TABLE commerce.inventory_balance_evidence
  ADD CONSTRAINT inventory_balance_evidence_nonnegative CHECK (
    before_on_hand >= 0 AND before_reserved >= 0 AND before_on_hand >= before_reserved
    AND after_on_hand >= 0 AND after_reserved >= 0 AND after_on_hand >= after_reserved
  );
ALTER TABLE commerce.inventory_operation_claim
  ADD CONSTRAINT inventory_operation_claim_hash_format CHECK (
    operation_hash ~ '^[a-f0-9]{64}$' AND result_hash ~ '^[a-f0-9]{64}$'
  );

-- Historical provider, transition, movement and claim evidence is append-only.
CREATE FUNCTION commerce.ucell_reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table % cannot be updated or deleted', TG_TABLE_NAME;
END $$;

CREATE TRIGGER payment_provider_event_evidence_append_only
  BEFORE UPDATE OR DELETE ON commerce.payment_provider_event_evidence
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER payment_state_transition_append_only
  BEFORE UPDATE OR DELETE ON commerce.payment_state_transition
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER payment_operation_claim_append_only
  BEFORE UPDATE OR DELETE ON commerce.payment_operation_claim
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER inventory_movement_append_only
  BEFORE UPDATE OR DELETE ON commerce.inventory_movement
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER inventory_balance_evidence_append_only
  BEFORE UPDATE OR DELETE ON commerce.inventory_balance_evidence
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
CREATE TRIGGER inventory_operation_claim_append_only
  BEFORE UPDATE OR DELETE ON commerce.inventory_operation_claim
  FOR EACH ROW EXECUTE FUNCTION commerce.ucell_reject_append_only_mutation();
