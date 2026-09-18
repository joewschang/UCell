-- CreateEnum
CREATE TYPE "membership"."QualificationKind" AS ENUM ('MEMBER_ORIGIN', 'COMPANY_BOOTSTRAP');

-- CreateEnum
CREATE TYPE "membership"."QualificationOwnerType" AS ENUM ('MEMBER', 'COMPANY');

-- CreateEnum
CREATE TYPE "organization"."BinaryTreeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED_TO_NEW', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "membership"."qualification" DROP CONSTRAINT "qualification_current_holder_person_id_fkey";

-- AlterTable
ALTER TABLE "membership"."qualification" ADD COLUMN     "current_company_principal_id" UUID,
ADD COLUMN     "kind" "membership"."QualificationKind" NOT NULL DEFAULT 'MEMBER_ORIGIN',
ALTER COLUMN "current_holder_person_id" DROP NOT NULL,
ALTER COLUMN "plan_level_code" DROP NOT NULL;

-- CreateTable
CREATE TABLE "membership"."company_principal" (
    "company_principal_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_principal_pkey" PRIMARY KEY ("company_principal_id")
);

-- CreateTable
CREATE TABLE "membership"."qualification_owner_interval" (
    "owner_interval_id" UUID NOT NULL,
    "qualification_id" UUID NOT NULL,
    "owner_type" "membership"."QualificationOwnerType" NOT NULL,
    "person_id" UUID,
    "company_principal_id" UUID,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "evidence_hash" TEXT NOT NULL,

    CONSTRAINT "qualification_owner_interval_pkey" PRIMARY KEY ("owner_interval_id")
);

-- CreateTable
CREATE TABLE "organization"."binary_tree" (
    "binary_tree_id" UUID NOT NULL,
    "tree_code" TEXT NOT NULL,
    "tree_name" TEXT NOT NULL,
    "status" "organization"."BinaryTreeStatus" NOT NULL DEFAULT 'DRAFT',
    "topology_version" INTEGER NOT NULL DEFAULT 1,
    "company_principal_id" UUID NOT NULL,
    "bootstrap_profile_version" TEXT NOT NULL DEFAULT 'COMPANY_BOOTSTRAP_PROFILE_V1',
    "economic_activation" TEXT NOT NULL DEFAULT 'PENDING_MAPPING',
    "created_by_actor_id" UUID NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binary_tree_pkey" PRIMARY KEY ("binary_tree_id")
);

-- CreateTable
CREATE TABLE "organization"."binary_tree_status_event" (
    "binary_tree_status_event_id" UUID NOT NULL,
    "binary_tree_id" UUID NOT NULL,
    "previous_status" "organization"."BinaryTreeStatus",
    "status" "organization"."BinaryTreeStatus" NOT NULL,
    "topology_version" INTEGER NOT NULL,
    "tree_name" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" UUID NOT NULL,
    "evidence_hash" TEXT NOT NULL,

    CONSTRAINT "binary_tree_status_event_pkey" PRIMARY KEY ("binary_tree_status_event_id")
);

-- CreateTable
CREATE TABLE "organization"."binary_tree_membership" (
    "qualification_id" UUID NOT NULL,
    "binary_tree_id" UUID NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "placement_tree_evidence_id" UUID NOT NULL,

    CONSTRAINT "binary_tree_membership_pkey" PRIMARY KEY ("qualification_id")
);

-- CreateTable
CREATE TABLE "organization"."tree_canonical_position" (
    "binary_tree_id" UUID NOT NULL,
    "position_no" INTEGER NOT NULL,
    "parent_position_no" INTEGER,
    "side" "organization"."SideCode",
    "occupant_qualification_id" UUID,
    "occupied_at" TIMESTAMPTZ(6),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_canonical_position_pkey" PRIMARY KEY ("binary_tree_id","position_no")
);

-- CreateTable
CREATE TABLE "organization"."founding_occupation_evidence" (
    "founding_occupation_evidence_id" UUID NOT NULL,
    "binary_tree_id" UUID NOT NULL,
    "position_no" INTEGER NOT NULL,
    "qualification_id" UUID NOT NULL,
    "initial_person_id" UUID NOT NULL,
    "company_sponsor_qualification_id" UUID NOT NULL,
    "sponsor_relationship_id" UUID NOT NULL,
    "actual_sponsor_sequence_no" INTEGER NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence_hash" TEXT NOT NULL,

    CONSTRAINT "founding_occupation_evidence_pkey" PRIMARY KEY ("founding_occupation_evidence_id")
);

-- CreateTable
CREATE TABLE "organization"."company_sponsor_designation" (
    "binary_tree_id" UUID NOT NULL,
    "qualification_id" UUID NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence_hash" TEXT NOT NULL,

    CONSTRAINT "company_sponsor_designation_pkey" PRIMARY KEY ("binary_tree_id")
);

-- CreateTable
CREATE TABLE "organization"."placement_tree_evidence" (
    "placement_tree_evidence_id" UUID NOT NULL,
    "binary_tree_id" UUID NOT NULL,
    "qualification_id" UUID NOT NULL,
    "parent_qualification_id" UUID,
    "side" "organization"."SideCode",
    "placement_kind" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "reason" TEXT NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topology_version" INTEGER NOT NULL,
    "correlation_id" UUID NOT NULL,
    "evidence_hash" TEXT NOT NULL,

    CONSTRAINT "placement_tree_evidence_pkey" PRIMARY KEY ("placement_tree_evidence_id")
);

-- CreateTable
CREATE TABLE "organization"."binary_tree_ancestry" (
    "binary_tree_id" UUID NOT NULL,
    "ancestor_qualification_id" UUID NOT NULL,
    "descendant_qualification_id" UUID NOT NULL,
    "depth" INTEGER NOT NULL,
    "first_side" "organization"."SideCode",
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binary_tree_ancestry_pkey" PRIMARY KEY ("binary_tree_id","ancestor_qualification_id","descendant_qualification_id")
);

-- CreateTable
CREATE TABLE "organization"."binary_tree_projection_checkpoint" (
    "binary_tree_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,
    "generation" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "data_through" TIMESTAMPTZ(6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binary_tree_projection_checkpoint_pkey" PRIMARY KEY ("binary_tree_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_principal_code_key" ON "membership"."company_principal"("code");

-- CreateIndex
CREATE INDEX "qualification_owner_interval_qualification_id_effective_fro_idx" ON "membership"."qualification_owner_interval"("qualification_id", "effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "qualification_owner_interval_qualification_id_source_type_s_key" ON "membership"."qualification_owner_interval"("qualification_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "binary_tree_tree_code_key" ON "organization"."binary_tree"("tree_code");

-- CreateIndex
CREATE INDEX "binary_tree_status_created_at_binary_tree_id_idx" ON "organization"."binary_tree"("status", "created_at", "binary_tree_id");

-- CreateIndex
CREATE INDEX "binary_tree_status_event_binary_tree_id_effective_at_record_idx" ON "organization"."binary_tree_status_event"("binary_tree_id", "effective_at", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "binary_tree_status_event_binary_tree_id_topology_version_key" ON "organization"."binary_tree_status_event"("binary_tree_id", "topology_version");

-- CreateIndex
CREATE UNIQUE INDEX "binary_tree_membership_placement_tree_evidence_id_key" ON "organization"."binary_tree_membership"("placement_tree_evidence_id");

-- CreateIndex
CREATE INDEX "binary_tree_membership_binary_tree_id_effective_from_qualif_idx" ON "organization"."binary_tree_membership"("binary_tree_id", "effective_from", "qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "binary_tree_membership_binary_tree_id_qualification_id_key" ON "organization"."binary_tree_membership"("binary_tree_id", "qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "tree_canonical_position_occupant_qualification_id_key" ON "organization"."tree_canonical_position"("occupant_qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "founding_occupation_evidence_qualification_id_key" ON "organization"."founding_occupation_evidence"("qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "founding_occupation_evidence_sponsor_relationship_id_key" ON "organization"."founding_occupation_evidence"("sponsor_relationship_id");

-- CreateIndex
CREATE UNIQUE INDEX "founding_occupation_evidence_binary_tree_id_position_no_key" ON "organization"."founding_occupation_evidence"("binary_tree_id", "position_no");

-- CreateIndex
CREATE UNIQUE INDEX "company_sponsor_designation_qualification_id_key" ON "organization"."company_sponsor_designation"("qualification_id");

-- CreateIndex
CREATE UNIQUE INDEX "placement_tree_evidence_qualification_id_key" ON "organization"."placement_tree_evidence"("qualification_id");

-- CreateIndex
CREATE INDEX "placement_tree_evidence_binary_tree_id_effective_at_qualifi_idx" ON "organization"."placement_tree_evidence"("binary_tree_id", "effective_at", "qualification_id");

-- CreateIndex
CREATE INDEX "binary_tree_ancestry_binary_tree_id_ancestor_qualification__idx" ON "organization"."binary_tree_ancestry"("binary_tree_id", "ancestor_qualification_id", "depth", "descendant_qualification_id");

-- CreateIndex
CREATE INDEX "binary_tree_ancestry_binary_tree_id_descendant_qualificatio_idx" ON "organization"."binary_tree_ancestry"("binary_tree_id", "descendant_qualification_id");

-- AddForeignKey
ALTER TABLE "membership"."qualification" ADD CONSTRAINT "qualification_current_company_principal_id_fkey" FOREIGN KEY ("current_company_principal_id") REFERENCES "membership"."company_principal"("company_principal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership"."qualification" ADD CONSTRAINT "qualification_current_holder_person_id_fkey" FOREIGN KEY ("current_holder_person_id") REFERENCES "identity"."person"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership"."qualification_owner_interval" ADD CONSTRAINT "qualification_owner_interval_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "membership"."qualification"("qualification_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership"."qualification_owner_interval" ADD CONSTRAINT "qualification_owner_interval_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "identity"."person"("person_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership"."qualification_owner_interval" ADD CONSTRAINT "qualification_owner_interval_company_principal_id_fkey" FOREIGN KEY ("company_principal_id") REFERENCES "membership"."company_principal"("company_principal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."binary_tree" ADD CONSTRAINT "binary_tree_company_principal_id_fkey" FOREIGN KEY ("company_principal_id") REFERENCES "membership"."company_principal"("company_principal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."binary_tree_status_event" ADD CONSTRAINT "binary_tree_status_event_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."binary_tree_membership" ADD CONSTRAINT "binary_tree_membership_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "membership"."qualification"("qualification_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."binary_tree_membership" ADD CONSTRAINT "binary_tree_membership_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."tree_canonical_position" ADD CONSTRAINT "tree_canonical_position_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."tree_canonical_position" ADD CONSTRAINT "tree_canonical_position_occupant_qualification_id_fkey" FOREIGN KEY ("occupant_qualification_id") REFERENCES "membership"."qualification"("qualification_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."founding_occupation_evidence" ADD CONSTRAINT "founding_occupation_evidence_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."founding_occupation_evidence" ADD CONSTRAINT "founding_occupation_evidence_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "membership"."qualification"("qualification_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."company_sponsor_designation" ADD CONSTRAINT "company_sponsor_designation_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."company_sponsor_designation" ADD CONSTRAINT "company_sponsor_designation_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "membership"."qualification"("qualification_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."placement_tree_evidence" ADD CONSTRAINT "placement_tree_evidence_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."placement_tree_evidence" ADD CONSTRAINT "placement_tree_evidence_qualification_id_fkey" FOREIGN KEY ("qualification_id") REFERENCES "membership"."qualification"("qualification_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."binary_tree_ancestry" ADD CONSTRAINT "binary_tree_ancestry_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization"."binary_tree_projection_checkpoint" ADD CONSTRAINT "binary_tree_projection_checkpoint_binary_tree_id_fkey" FOREIGN KEY ("binary_tree_id") REFERENCES "organization"."binary_tree"("binary_tree_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Train B integrity. Company economic parameter binding remains deliberately closed.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE membership.qualification_owner_interval ADD COLUMN closed_recorded_at timestamptz(6);
ALTER TABLE membership.qualification ADD CONSTRAINT qualification_explicit_owner_xor CHECK ((current_holder_person_id IS NOT NULL) <> (current_company_principal_id IS NOT NULL));
ALTER TABLE membership.qualification ADD CONSTRAINT qualification_kind_plan_binding CHECK (
 (kind='MEMBER_ORIGIN' AND plan_level_code IS NOT NULL) OR
 (kind='COMPANY_BOOTSTRAP' AND current_holder_person_id IS NULL AND current_company_principal_id IS NOT NULL AND plan_level_code IS NULL));
ALTER TABLE membership.qualification_owner_interval ADD CONSTRAINT owner_interval_principal_xor CHECK (
 (owner_type='MEMBER' AND person_id IS NOT NULL AND company_principal_id IS NULL) OR
 (owner_type='COMPANY' AND person_id IS NULL AND company_principal_id IS NOT NULL));
ALTER TABLE membership.qualification_owner_interval ADD CONSTRAINT owner_interval_range CHECK (effective_to IS NULL OR effective_to>effective_from);
ALTER TABLE membership.qualification_owner_interval ADD CONSTRAINT owner_interval_close_recording CHECK ((effective_to IS NULL)=(closed_recorded_at IS NULL));
ALTER TABLE membership.qualification_owner_interval ADD CONSTRAINT owner_interval_no_overlap EXCLUDE USING gist
 (qualification_id WITH =,tstzrange(effective_from,effective_to,'[)') WITH &&);
ALTER TABLE organization.binary_tree ADD CONSTRAINT tree_nonmonetary_gate CHECK (economic_activation='PENDING_MAPPING' AND bootstrap_profile_version='COMPANY_BOOTSTRAP_PROFILE_V1');
ALTER TABLE organization.binary_tree ADD CONSTRAINT tree_names_valid CHECK (length(btrim(tree_name)) BETWEEN 1 AND 120 AND tree_code ~ '^[A-Z][A-Z0-9_-]{2,39}$' AND topology_version>0);
ALTER TABLE organization.binary_tree_status_event ADD CONSTRAINT tree_status_reason CHECK (length(btrim(reason))>0 AND length(evidence_hash)=64);
ALTER TABLE organization.tree_canonical_position ADD CONSTRAINT canonical_topology CHECK (
 (position_no=1 AND parent_position_no IS NULL AND side IS NULL) OR
 (position_no IN (2,3) AND parent_position_no=1 AND side=CASE WHEN position_no=2 THEN 'LEFT'::organization."SideCode" ELSE 'RIGHT'::organization."SideCode" END) OR
 (position_no IN (4,5) AND parent_position_no=2 AND side=CASE WHEN position_no=4 THEN 'LEFT'::organization."SideCode" ELSE 'RIGHT'::organization."SideCode" END) OR
 (position_no IN (6,7) AND parent_position_no=3 AND side=CASE WHEN position_no=6 THEN 'LEFT'::organization."SideCode" ELSE 'RIGHT'::organization."SideCode" END));
ALTER TABLE organization.tree_canonical_position ADD CONSTRAINT canonical_occupation_time CHECK ((occupant_qualification_id IS NULL)=(occupied_at IS NULL));
ALTER TABLE organization.tree_canonical_position ADD CONSTRAINT canonical_parent_fk FOREIGN KEY(binary_tree_id,parent_position_no) REFERENCES organization.tree_canonical_position(binary_tree_id,position_no) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE organization.founding_occupation_evidence ADD CONSTRAINT founding_position_range CHECK (position_no BETWEEN 4 AND 7 AND actual_sponsor_sequence_no>=3 AND length(evidence_hash)=64);
ALTER TABLE organization.founding_occupation_evidence ADD CONSTRAINT founding_person_fk FOREIGN KEY(initial_person_id) REFERENCES identity.person(person_id);
ALTER TABLE organization.founding_occupation_evidence ADD CONSTRAINT founding_sponsor_fk FOREIGN KEY(sponsor_relationship_id) REFERENCES organization.sponsor_relationship(sponsor_relationship_id);
ALTER TABLE organization.binary_tree_membership ADD CONSTRAINT membership_placement_evidence_fk FOREIGN KEY(placement_tree_evidence_id) REFERENCES organization.placement_tree_evidence(placement_tree_evidence_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE organization.binary_tree_ancestry ADD CONSTRAINT ancestry_ancestor_membership_fk FOREIGN KEY(binary_tree_id,ancestor_qualification_id) REFERENCES organization.binary_tree_membership(binary_tree_id,qualification_id);
ALTER TABLE organization.binary_tree_ancestry ADD CONSTRAINT ancestry_descendant_membership_fk FOREIGN KEY(binary_tree_id,descendant_qualification_id) REFERENCES organization.binary_tree_membership(binary_tree_id,qualification_id);
ALTER TABLE organization.binary_tree_ancestry ADD CONSTRAINT ancestry_depth CHECK ((depth=0 AND ancestor_qualification_id=descendant_qualification_id AND first_side IS NULL) OR (depth>0 AND ancestor_qualification_id<>descendant_qualification_id AND first_side IS NOT NULL));
ALTER TABLE organization.placement_tree_evidence ADD CONSTRAINT placement_tree_source CHECK (length(btrim(reason))>0 AND length(evidence_hash)=64 AND actor_type IN ('ADMIN','MEMBER','SYSTEM') AND (actor_type='SYSTEM' OR actor_id IS NOT NULL) AND placement_kind IN ('BOOTSTRAP_ROOT','BOOTSTRAP','PLACEMENT'));
ALTER TABLE organization.placement_tree_evidence ADD CONSTRAINT placement_parent_side CHECK ((placement_kind='BOOTSTRAP_ROOT' AND parent_qualification_id IS NULL AND side IS NULL) OR (placement_kind<>'BOOTSTRAP_ROOT' AND parent_qualification_id IS NOT NULL AND side IS NOT NULL));
-- A system company principal is not a Person and has no authentication identity.
INSERT INTO membership.company_principal(company_principal_id,code,display_name,status) VALUES(gen_random_uuid(),'UCELL_COMPANY','UCell Company System Principal','ACTIVE');

CREATE FUNCTION membership.ucell_guard_bootstrap_qualification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.kind='COMPANY_BOOTSTRAP' THEN RAISE EXCEPTION 'BOOTSTRAP_QUALIFICATION_LOCKED' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.kind<>OLD.kind OR (OLD.kind='COMPANY_BOOTSTRAP' AND (to_jsonb(NEW)-'updated_at')<>(to_jsonb(OLD)-'updated_at')) THEN
  RAISE EXCEPTION 'BOOTSTRAP_QUALIFICATION_LOCKED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bootstrap_qualification_locked BEFORE UPDATE OR DELETE ON membership.qualification FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_bootstrap_qualification();
CREATE FUNCTION membership.ucell_guard_owner_interval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OWNER_EVIDENCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM membership.qualification WHERE qualification_id=OLD.qualification_id AND kind='COMPANY_BOOTSTRAP')
  OR (to_jsonb(NEW)-'effective_to'-'closed_recorded_at')<>(to_jsonb(OLD)-'effective_to'-'closed_recorded_at')
  OR OLD.effective_to IS NOT NULL OR NEW.effective_to IS NULL OR NEW.closed_recorded_at IS NULL THEN
  RAISE EXCEPTION 'OWNER_EVIDENCE_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER owner_interval_close_only BEFORE UPDATE OR DELETE ON membership.qualification_owner_interval FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_owner_interval();
CREATE FUNCTION membership.ucell_verify_explicit_company_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.current_company_principal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM membership.qualification_owner_interval i
   WHERE i.qualification_id=NEW.qualification_id AND i.owner_type='COMPANY' AND i.company_principal_id=NEW.current_company_principal_id
   AND i.effective_from<=statement_timestamp() AND i.effective_to IS NULL) THEN
  RAISE EXCEPTION 'COMPANY_OWNER_INTERVAL_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER company_owner_evidence_required AFTER INSERT OR UPDATE ON membership.qualification DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION membership.ucell_verify_explicit_company_owner();

CREATE FUNCTION organization.ucell_guard_tree_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'TREE_DELETE_FORBIDDEN' USING ERRCODE='23514'; END IF;
 IF OLD.status='ARCHIVED' OR NEW.binary_tree_id<>OLD.binary_tree_id OR NEW.tree_code<>OLD.tree_code OR NEW.company_principal_id<>OLD.company_principal_id
  OR NEW.bootstrap_profile_version<>OLD.bootstrap_profile_version OR NEW.economic_activation<>OLD.economic_activation OR NEW.effective_at<>OLD.effective_at
  OR NEW.created_at<>OLD.created_at OR NEW.created_by_actor_id<>OLD.created_by_actor_id OR NEW.topology_version<>OLD.topology_version+1 THEN
  RAISE EXCEPTION 'TREE_IMMUTABLE_IDENTITY_OR_VERSION' USING ERRCODE='23514';
 END IF;
 IF NEW.status<>OLD.status AND NOT ((OLD.status='DRAFT' AND NEW.status IN ('ACTIVE','ARCHIVED')) OR (OLD.status='ACTIVE' AND NEW.status='CLOSED_TO_NEW') OR (OLD.status='CLOSED_TO_NEW' AND NEW.status IN ('ACTIVE','ARCHIVED'))) THEN
  RAISE EXCEPTION 'TREE_TRANSITION_INVALID' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tree_lifecycle_guard BEFORE UPDATE OR DELETE ON organization.binary_tree FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_tree_lifecycle();
CREATE FUNCTION organization.ucell_guard_canonical_position() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CANONICAL_POSITION_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF OLD.position_no<=3 OR OLD.occupant_qualification_id IS NOT NULL OR NEW.occupant_qualification_id IS NULL
  OR (to_jsonb(OLD)-'occupant_qualification_id'-'occupied_at')<>(to_jsonb(NEW)-'occupant_qualification_id'-'occupied_at') THEN
  RAISE EXCEPTION 'CANONICAL_POSITION_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_position_occupation_once BEFORE UPDATE OR DELETE ON organization.tree_canonical_position FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_canonical_position();

CREATE FUNCTION organization.ucell_guard_tree_placement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p organization.binary_tree_membership; c organization.binary_tree_membership; t organization.binary_tree; k membership."QualificationKind";
BEGIN
 SELECT * INTO p FROM organization.binary_tree_membership WHERE qualification_id=NEW.parent_qualification_id;
 SELECT * INTO c FROM organization.binary_tree_membership WHERE qualification_id=NEW.child_qualification_id;
 IF p.qualification_id IS NULL AND c.qualification_id IS NULL THEN RETURN NEW; END IF;
 IF p.qualification_id IS NULL OR c.qualification_id IS NULL OR p.binary_tree_id<>c.binary_tree_id THEN RAISE EXCEPTION 'BINARY_TREE_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
 SELECT * INTO t FROM organization.binary_tree WHERE binary_tree_id=p.binary_tree_id FOR UPDATE;
 SELECT kind INTO k FROM membership.qualification WHERE qualification_id=NEW.child_qualification_id;
 IF p.effective_from>NEW.effective_from OR c.effective_from<>NEW.effective_from OR EXISTS(SELECT 1 FROM organization.binary_placement WHERE child_qualification_id=NEW.child_qualification_id) THEN RAISE EXCEPTION 'TREE_PLACEMENT_HISTORICAL_CONFLICT' USING ERRCODE='23514'; END IF;
 IF k='COMPANY_BOOTSTRAP' THEN
  IF t.status<>'DRAFT' OR NOT EXISTS(SELECT 1 FROM organization.tree_canonical_position child JOIN organization.tree_canonical_position parent ON parent.binary_tree_id=child.binary_tree_id AND parent.position_no=child.parent_position_no
   WHERE child.binary_tree_id=t.binary_tree_id AND child.position_no IN(2,3) AND child.occupant_qualification_id=NEW.child_qualification_id AND parent.occupant_qualification_id=NEW.parent_qualification_id AND child.side=NEW.side) THEN RAISE EXCEPTION 'BOOTSTRAP_PLACEMENT_LOCKED' USING ERRCODE='23514'; END IF;
 ELSIF t.status<>'ACTIVE' THEN RAISE EXCEPTION 'TREE_NOT_OPEN_TO_PLACEMENT' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER binary_tree_placement_guard BEFORE INSERT ON organization.binary_placement FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_tree_placement();
CREATE FUNCTION organization.ucell_guard_tree_edge_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM organization.binary_tree_membership WHERE qualification_id=OLD.child_qualification_id) THEN RAISE EXCEPTION 'TREE_PLACEMENT_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER tree_binary_edge_immutable BEFORE UPDATE OR DELETE ON organization.binary_placement FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_tree_edge_mutation();
-- Existing first/third-left SQL function/trigger stays enabled and unchanged.
CREATE TRIGGER tree_sponsor_edge_immutable BEFORE UPDATE OR DELETE ON organization.sponsor_relationship FOR EACH ROW EXECUTE FUNCTION organization.ucell_guard_tree_edge_mutation();

CREATE FUNCTION organization.ucell_verify_tree_bootstrap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE root_id uuid; second_id uuid; third_id uuid;
BEGIN
 SELECT occupant_qualification_id INTO root_id FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=1;
 SELECT occupant_qualification_id INTO second_id FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=2;
 SELECT occupant_qualification_id INTO third_id FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=3;
 IF (SELECT count(*) FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id)<>7
  OR (SELECT count(*) FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND occupant_qualification_id IS NOT NULL)<>3
  OR (SELECT count(*) FROM organization.binary_tree_membership WHERE binary_tree_id=NEW.binary_tree_id)<>3
  OR (SELECT count(*) FROM membership.qualification WHERE qualification_id IN(root_id,second_id,third_id) AND kind='COMPANY_BOOTSTRAP' AND current_company_principal_id=NEW.company_principal_id AND plan_level_code IS NULL)<>3
  OR NOT EXISTS(SELECT 1 FROM organization.company_sponsor_designation WHERE binary_tree_id=NEW.binary_tree_id AND qualification_id=root_id)
  OR EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE child_qualification_id=root_id)
  OR EXISTS(SELECT 1 FROM organization.binary_placement WHERE child_qualification_id=root_id)
  OR NOT EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE sponsor_qualification_id=root_id AND child_qualification_id=second_id AND sponsor_sequence_no=1)
  OR NOT EXISTS(SELECT 1 FROM organization.sponsor_relationship WHERE sponsor_qualification_id=root_id AND child_qualification_id=third_id AND sponsor_sequence_no=2)
  OR NOT EXISTS(SELECT 1 FROM organization.binary_placement WHERE parent_qualification_id=root_id AND child_qualification_id=second_id AND side='LEFT')
  OR NOT EXISTS(SELECT 1 FROM organization.binary_placement WHERE parent_qualification_id=root_id AND child_qualification_id=third_id AND side='RIGHT') THEN
  RAISE EXCEPTION 'TREE_BOOTSTRAP_INCOMPLETE' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tree_bootstrap_complete AFTER INSERT ON organization.binary_tree DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organization.ucell_verify_tree_bootstrap();

CREATE TRIGGER tree_status_event_append_only BEFORE UPDATE OR DELETE ON organization.binary_tree_status_event FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER tree_membership_append_only BEFORE UPDATE OR DELETE ON organization.binary_tree_membership FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER founding_occupation_append_only BEFORE UPDATE OR DELETE ON organization.founding_occupation_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER company_sponsor_append_only BEFORE UPDATE OR DELETE ON organization.company_sponsor_designation FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER tree_placement_evidence_append_only BEFORE UPDATE OR DELETE ON organization.placement_tree_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER tree_ancestry_append_only BEFORE UPDATE OR DELETE ON organization.binary_tree_ancestry FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

-- Every published tree state must carry matching immutable evidence.
CREATE FUNCTION organization.ucell_verify_tree_change_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.tree_name IS DISTINCT FROM OLD.tree_name THEN
  IF NOT EXISTS(SELECT 1 FROM organization.binary_tree_status_event e WHERE e.binary_tree_id=NEW.binary_tree_id
   AND e.topology_version=NEW.topology_version AND e.status=NEW.status AND e.tree_name=NEW.tree_name
   AND (TG_OP='INSERT' OR e.previous_status=OLD.status)) THEN
   RAISE EXCEPTION 'TREE_STATUS_EVIDENCE_REQUIRED' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM organization.binary_tree_projection_checkpoint c WHERE c.binary_tree_id=NEW.binary_tree_id
   AND c.source_version>=NEW.topology_version AND c.status='READY') THEN
  RAISE EXCEPTION 'TREE_CHECKPOINT_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tree_change_evidence_required AFTER INSERT OR UPDATE ON organization.binary_tree DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organization.ucell_verify_tree_change_evidence();

CREATE FUNCTION organization.ucell_verify_tree_membership_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e organization.placement_tree_evidence;
BEGIN
 SELECT * INTO e FROM organization.placement_tree_evidence WHERE placement_tree_evidence_id=NEW.placement_tree_evidence_id;
 IF e.qualification_id IS DISTINCT FROM NEW.qualification_id OR e.binary_tree_id IS DISTINCT FROM NEW.binary_tree_id
  OR e.effective_at IS DISTINCT FROM NEW.effective_from THEN
  RAISE EXCEPTION 'TREE_MEMBERSHIP_EVIDENCE_MISMATCH' USING ERRCODE='23514';
 END IF;
 IF e.placement_kind<>'BOOTSTRAP_ROOT' AND NOT EXISTS(SELECT 1 FROM organization.binary_placement b
   WHERE b.child_qualification_id=NEW.qualification_id AND b.parent_qualification_id=e.parent_qualification_id
   AND b.side=e.side AND b.effective_from=e.effective_at AND b.effective_to IS NULL) THEN
  RAISE EXCEPTION 'TREE_MEMBERSHIP_PLACEMENT_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tree_membership_evidence_required AFTER INSERT ON organization.binary_tree_membership DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organization.ucell_verify_tree_membership_evidence();

-- Unbound Bootstrap qualifications cannot acquire a fabricated member history or money.
CREATE FUNCTION membership.ucell_guard_bootstrap_dependent_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE qid uuid;
BEGIN
 qid := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
 IF EXISTS(SELECT 1 FROM membership.qualification WHERE qualification_id=qid AND kind='COMPANY_BOOTSTRAP') THEN
  RAISE EXCEPTION 'COMPANY_BOOTSTRAP_PROFILE_PENDING_MAPPING' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bootstrap_holder_history_forbidden BEFORE INSERT OR UPDATE ON membership.qualification_holder_history FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_bootstrap_dependent_write('qualification_id');
CREATE TRIGGER bootstrap_plan_history_forbidden BEFORE INSERT OR UPDATE ON membership.qualification_plan_history FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_bootstrap_dependent_write('qualification_id');
CREATE TRIGGER bootstrap_award_activation_closed BEFORE INSERT ON ledger.bonus_award FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_bootstrap_dependent_write('recipient_qualification_id');
CREATE TRIGGER bootstrap_payable_activation_closed BEFORE INSERT ON ledger.payable_entry FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_bootstrap_dependent_write('qualification_id');

CREATE FUNCTION membership.ucell_guard_archived_tree_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state organization."BinaryTreeStatus";
BEGIN
 SELECT t.status INTO state FROM organization.binary_tree t JOIN organization.binary_tree_membership m ON m.binary_tree_id=t.binary_tree_id
  WHERE m.qualification_id=NEW.qualification_id FOR SHARE OF t;
 IF state='ARCHIVED' THEN RAISE EXCEPTION 'TREE_ARCHIVED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER archived_tree_owner_immutable BEFORE INSERT OR UPDATE ON membership.qualification_owner_interval FOR EACH ROW EXECUTE FUNCTION membership.ucell_guard_archived_tree_owner();

CREATE FUNCTION organization.ucell_verify_canonical_occupation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE slot organization.tree_canonical_position; fact organization.founding_occupation_evidence; parent_id uuid;
BEGIN
 SELECT * INTO slot FROM organization.tree_canonical_position WHERE binary_tree_id=NEW.binary_tree_id AND position_no=NEW.position_no;
 IF TG_TABLE_NAME='founding_occupation_evidence' THEN
  IF slot.occupant_qualification_id IS DISTINCT FROM NEW.qualification_id THEN RAISE EXCEPTION 'FOUNDING_OCCUPATION_EVIDENCE_MISMATCH' USING ERRCODE='23514'; END IF;
 END IF;
 IF slot.occupant_qualification_id IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM organization.binary_tree_membership m WHERE m.qualification_id=slot.occupant_qualification_id AND m.binary_tree_id=slot.binary_tree_id) THEN
  RAISE EXCEPTION 'CANONICAL_OCCUPANT_TREE_MISMATCH' USING ERRCODE='23514';
 END IF;
 IF slot.position_no>=4 THEN
  SELECT * INTO fact FROM organization.founding_occupation_evidence WHERE binary_tree_id=slot.binary_tree_id AND position_no=slot.position_no AND qualification_id=slot.occupant_qualification_id;
  SELECT occupant_qualification_id INTO parent_id FROM organization.tree_canonical_position WHERE binary_tree_id=slot.binary_tree_id AND position_no=slot.parent_position_no;
  IF fact.qualification_id IS NULL OR fact.effective_at<>slot.occupied_at
   OR NOT EXISTS(SELECT 1 FROM membership.qualification q WHERE q.qualification_id=fact.qualification_id AND q.kind='MEMBER_ORIGIN')
   OR NOT EXISTS(SELECT 1 FROM organization.company_sponsor_designation d WHERE d.binary_tree_id=fact.binary_tree_id AND d.qualification_id=fact.company_sponsor_qualification_id)
   OR NOT EXISTS(SELECT 1 FROM organization.sponsor_relationship s WHERE s.sponsor_relationship_id=fact.sponsor_relationship_id AND s.child_qualification_id=fact.qualification_id AND s.sponsor_qualification_id=fact.company_sponsor_qualification_id AND s.sponsor_sequence_no=fact.actual_sponsor_sequence_no AND s.effective_from<=fact.effective_at AND (s.effective_to IS NULL OR s.effective_to>fact.effective_at))
   OR NOT EXISTS(SELECT 1 FROM organization.binary_placement b WHERE b.child_qualification_id=fact.qualification_id AND b.parent_qualification_id=parent_id AND b.side=slot.side AND b.effective_from=fact.effective_at)
   OR NOT EXISTS(SELECT 1 FROM membership.qualification_owner_interval o WHERE o.qualification_id=fact.qualification_id AND o.owner_type='MEMBER' AND o.person_id=fact.initial_person_id AND o.effective_from<=fact.effective_at AND (o.effective_to IS NULL OR o.effective_to>fact.effective_at)) THEN
   RAISE EXCEPTION 'FOUNDING_OCCUPATION_EVIDENCE_MISMATCH' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER canonical_occupation_evidence_required AFTER INSERT OR UPDATE ON organization.tree_canonical_position DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organization.ucell_verify_canonical_occupation();
CREATE CONSTRAINT TRIGGER founding_occupation_evidence_matches AFTER INSERT ON organization.founding_occupation_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION organization.ucell_verify_canonical_occupation();
