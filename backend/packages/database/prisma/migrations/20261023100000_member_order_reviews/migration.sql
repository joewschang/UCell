CREATE TABLE commerce.member_order_review (
 order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
 person_id uuid NOT NULL REFERENCES identity.person(person_id),
 rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (char_length(comment)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_id,person_id)
);
CREATE INDEX member_order_review_person_idx ON commerce.member_order_review(person_id,created_at);
