ALTER TABLE commerce."order" DROP CONSTRAINT order_retail_purchaser_shape;
ALTER TABLE commerce."order" DROP CONSTRAINT order_purchaser_only_retail;
ALTER TABLE commerce."order" ADD CONSTRAINT order_retail_purchaser_shape CHECK (
 (purpose = 'RETAIL' AND (qualification_id IS NOT NULL OR purchaser_person_id IS NOT NULL))
 OR (purpose = 'FORMAL_MEMBERSHIP_FEE' AND qualification_id IS NULL AND purchaser_person_id IS NOT NULL AND currency='TWD' AND net_amount=600 AND gross_amount=600 AND discount_amount=0)
 OR (purpose NOT IN ('RETAIL','FORMAL_MEMBERSHIP_FEE') AND qualification_id IS NOT NULL)
);
ALTER TABLE commerce."order" ADD CONSTRAINT order_purchaser_only_retail CHECK (
 purchaser_person_id IS NULL OR purpose IN ('RETAIL','FORMAL_MEMBERSHIP_FEE')
);
