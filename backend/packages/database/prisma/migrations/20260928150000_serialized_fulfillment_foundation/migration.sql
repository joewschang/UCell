CREATE TYPE commerce."SerializedUnitStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'SHIPPED', 'RETURNED', 'QUARANTINED', 'RECALLED');

CREATE TABLE commerce.product_serial_batch (
  product_serial_batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  serial_prefix char(1) NOT NULL,
  batch_sequence integer NOT NULL,
  batch_code text NOT NULL,
  expires_at timestamptz(6),
  status membership."RecordStatus" NOT NULL DEFAULT 'EFFECTIVE',
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_serial_batch_pkey PRIMARY KEY (product_serial_batch_id),
  CONSTRAINT product_serial_batch_product_id_fkey FOREIGN KEY (product_id) REFERENCES commerce.product_reference(product_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT product_serial_batch_product_id_batch_sequence_key UNIQUE (product_id, batch_sequence),
  CONSTRAINT product_serial_batch_product_id_batch_code_key UNIQUE (product_id, batch_code),
  CONSTRAINT product_serial_batch_prefix_check CHECK (serial_prefix ~ '^[A-E]$'),
  CONSTRAINT product_serial_batch_sequence_check CHECK (batch_sequence BETWEEN 1 AND 999)
);
CREATE INDEX product_serial_batch_serial_prefix_batch_sequence_idx ON commerce.product_serial_batch(serial_prefix, batch_sequence);

CREATE TABLE commerce.serialized_unit (
  serialized_unit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_serial_batch_id uuid NOT NULL,
  serial_no char(8) NOT NULL,
  serial_sequence integer NOT NULL,
  status commerce."SerializedUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT serialized_unit_pkey PRIMARY KEY (serialized_unit_id),
  CONSTRAINT serialized_unit_product_serial_batch_id_fkey FOREIGN KEY (product_serial_batch_id) REFERENCES commerce.product_serial_batch(product_serial_batch_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT serialized_unit_serial_no_key UNIQUE (serial_no),
  CONSTRAINT serialized_unit_product_serial_batch_id_serial_sequence_key UNIQUE (product_serial_batch_id, serial_sequence),
  CONSTRAINT serialized_unit_serial_no_check CHECK (serial_no ~ '^[A-E][0-9]{7}$'),
  CONSTRAINT serialized_unit_sequence_check CHECK (serial_sequence BETWEEN 1 AND 9999)
);
CREATE INDEX serialized_unit_status_product_serial_batch_id_idx ON commerce.serialized_unit(status, product_serial_batch_id);

CREATE TABLE commerce.fulfillment_serial_allocation (
  fulfillment_serial_allocation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL,
  fulfillment_source_allocation_id uuid NOT NULL,
  serialized_unit_id uuid NOT NULL,
  scanned_by_actor text NOT NULL,
  scanned_at timestamptz(6) NOT NULL,
  correlation_id uuid NOT NULL,
  CONSTRAINT fulfillment_serial_allocation_pkey PRIMARY KEY (fulfillment_serial_allocation_id),
  CONSTRAINT fulfillment_serial_allocation_fulfillment_id_fkey FOREIGN KEY (fulfillment_id) REFERENCES commerce.fulfillment(fulfillment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fulfillment_serial_allocation_source_fkey FOREIGN KEY (fulfillment_source_allocation_id) REFERENCES commerce.fulfillment_source_allocation(fulfillment_source_allocation_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fulfillment_serial_allocation_serial_fkey FOREIGN KEY (serialized_unit_id) REFERENCES commerce.serialized_unit(serialized_unit_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fulfillment_serial_allocation_serialized_unit_id_key UNIQUE (serialized_unit_id),
  CONSTRAINT fulfillment_serial_allocation_source_serial_key UNIQUE (fulfillment_source_allocation_id, serialized_unit_id)
);
CREATE INDEX fulfillment_serial_allocation_fulfillment_id_scanned_at_idx ON commerce.fulfillment_serial_allocation(fulfillment_id, scanned_at);

