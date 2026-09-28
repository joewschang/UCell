CREATE TABLE commerce.fulfillment_source_allocation (
  fulfillment_source_allocation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES commerce.fulfillment(fulfillment_id),
  order_line_id uuid NOT NULL REFERENCES commerce.order_line(order_line_id),
  allocated_quantity numeric(18,4) NOT NULL CHECK (allocated_quantity > 0),
  sku_snapshot text NOT NULL,
  commercial_offering_snapshot jsonb,
  line_purpose text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE (fulfillment_id, order_line_id)
);
CREATE INDEX fulfillment_source_allocation_order_line_idx ON commerce.fulfillment_source_allocation(order_line_id);