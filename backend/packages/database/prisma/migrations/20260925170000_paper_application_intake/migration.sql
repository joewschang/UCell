-- Paper intake is provenance for an existing authoritative Person and Order.
-- It contains metadata and a secure document reference only: no identity document
-- payload, bank data, or natural-person fingerprint is stored here.
CREATE TABLE commerce.paper_application (
  paper_application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_application_no varchar(80) NOT NULL UNIQUE,
  person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL,
  evidence_document_ref varchar(500),
  status varchar(32) NOT NULL DEFAULT 'OPEN',
  created_by uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
  order_id uuid UNIQUE REFERENCES commerce."order"(order_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paper_application_no_normalized CHECK (paper_application_no = btrim(paper_application_no) AND length(paper_application_no) BETWEEN 1 AND 80)
);
CREATE INDEX paper_application_person_received_idx ON commerce.paper_application(person_id, received_at);
