ALTER TABLE membership.qualification_setup DROP CONSTRAINT qualification_setup_setup_status_check;
ALTER TABLE membership.qualification_setup ADD CONSTRAINT qualification_setup_setup_status_check CHECK(setup_status IN ('PURCHASE_PENDING','PURCHASED','BALL_SETUP_PENDING','PLACEMENT_PENDING','PLACEMENT_OVERDUE','PLACED','ACTIVE','CANCELLED','REVERSED','RETURN_REVIEW_PENDING'));
