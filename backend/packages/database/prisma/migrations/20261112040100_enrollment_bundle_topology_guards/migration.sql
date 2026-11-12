-- Bundle rows are an application commitment. While a ball is a draft, staff
-- and legacy writers use exactly the same internal sponsor and placement plan.
CREATE FUNCTION membership.enrollment_bundle_planned_parent(child_id uuid)
RETURNS TABLE(parent_id uuid, planned_side organization."SideCode", direct_sequence integer)
LANGUAGE sql STABLE AS $$
 SELECT parent.qualification_id,
        CASE WHEN child.position % 2=0 THEN 'LEFT' ELSE 'RIGHT' END::organization."SideCode",
        CASE WHEN child.position % 2=0 THEN 1 ELSE 2 END
 FROM membership.enrollment_bundle_ball child
 JOIN membership.enrollment_bundle_ball parent
   ON parent.bundle_id=child.bundle_id AND parent.position=child.position/2
 JOIN membership.qualification q ON q.qualification_id=child.qualification_id
 WHERE child.qualification_id=child_id AND child.position>1 AND q.status='DRAFT'
$$;

CREATE FUNCTION organization.check_enrollment_bundle_sponsor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected record;
BEGIN
 SELECT * INTO expected FROM membership.enrollment_bundle_planned_parent(NEW.child_qualification_id);
 IF FOUND AND (NEW.sponsor_qualification_id<>expected.parent_id OR NEW.sponsor_sequence_no<>expected.direct_sequence OR NEW.effective_to IS NOT NULL) THEN
   RAISE EXCEPTION 'BUNDLE_SPONSOR_MISMATCH' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER enrollment_bundle_sponsor
BEFORE INSERT OR UPDATE OF sponsor_qualification_id, sponsor_sequence_no, effective_to
ON organization.sponsor_relationship FOR EACH ROW EXECUTE FUNCTION organization.check_enrollment_bundle_sponsor();

CREATE FUNCTION organization.check_enrollment_bundle_sponsor_selection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE planned uuid;
BEGIN
 SELECT parent_id INTO planned FROM membership.enrollment_bundle_planned_parent(NEW.qualification_id);
 IF FOUND AND NEW.selected_sponsor_qualification_id IS DISTINCT FROM planned THEN
   RAISE EXCEPTION 'BUNDLE_SPONSOR_MISMATCH' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER enrollment_bundle_sponsor_selection
BEFORE INSERT OR UPDATE OF selected_sponsor_qualification_id
ON organization.qualification_sponsor_selection_evidence FOR EACH ROW EXECUTE FUNCTION organization.check_enrollment_bundle_sponsor_selection();

CREATE FUNCTION organization.check_enrollment_bundle_slot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected record; reserved_for uuid;
BEGIN
 SELECT * INTO expected FROM membership.enrollment_bundle_planned_parent(NEW.child_qualification_id);
 IF FOUND AND (NEW.parent_qualification_id<>expected.parent_id OR NEW.side<>expected.planned_side) THEN
   RAISE EXCEPTION 'BUNDLE_PLACEMENT_MISMATCH' USING ERRCODE='23514';
 END IF;

 SELECT c.qualification_id INTO reserved_for
 FROM membership.enrollment_bundle_ball p
 JOIN membership.enrollment_bundle_ball c ON c.bundle_id=p.bundle_id
   AND c.position::bigint=p.position::bigint*2+CASE WHEN NEW.side='LEFT' THEN 0 ELSE 1 END
 JOIN membership.qualification q ON q.qualification_id=c.qualification_id AND q.status='DRAFT'
 WHERE p.qualification_id=NEW.parent_qualification_id;
 IF FOUND AND reserved_for<>NEW.child_qualification_id THEN
   RAISE EXCEPTION 'BUNDLE_SLOT_RESERVED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER enrollment_bundle_binary_slot
BEFORE INSERT OR UPDATE OF parent_qualification_id, child_qualification_id, side
ON organization.binary_placement FOR EACH ROW EXECUTE FUNCTION organization.check_enrollment_bundle_slot();

-- Initial placement is one transaction even for administrative callers that write
-- binary edges directly. Later audited changes to effective balls remain possible.
CREATE FUNCTION organization.check_enrollment_bundle_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE group_id uuid; first_placement timestamptz;
BEGIN
 SELECT b.bundle_id,s.placed_at INTO group_id,first_placement
 FROM membership.enrollment_bundle_ball b
 LEFT JOIN membership.qualification_setup s ON s.qualification_id=b.qualification_id
 WHERE b.qualification_id=NEW.child_qualification_id;
 IF NOT FOUND OR first_placement<NEW.effective_from THEN RETURN NULL; END IF;

 IF EXISTS (
   SELECT 1 FROM membership.enrollment_bundle_ball b
   JOIN membership.qualification q ON q.qualification_id=b.qualification_id
   LEFT JOIN membership.qualification_setup s ON s.qualification_id=b.qualification_id
   LEFT JOIN organization.binary_placement edge ON edge.child_qualification_id=b.qualification_id
   WHERE b.bundle_id=group_id AND
      (q.status<>'EFFECTIVE' OR s.setup_status IS DISTINCT FROM 'PLACED' OR edge.child_qualification_id IS NULL)
 ) THEN RAISE EXCEPTION 'BUNDLE_GROUP_PLACEMENT_INCOMPLETE' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER enrollment_bundle_complete
AFTER INSERT ON organization.binary_placement DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION organization.check_enrollment_bundle_complete();

-- Preserve the signed checkout's ball, qualification order and add-on binding.
-- Expired checkouts use a new bundle and retain these original rows as history.
CREATE FUNCTION membership.keep_enrollment_bundle_ball() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'BUNDLE_PLAN_IMMUTABLE' USING ERRCODE='23514';
END $$;

CREATE TRIGGER keep_enrollment_bundle_ball BEFORE UPDATE OR DELETE ON membership.enrollment_bundle_ball
FOR EACH ROW EXECUTE FUNCTION membership.keep_enrollment_bundle_ball();
