BEGIN;
-- Presentation names belong to the stable product. Approved versions retain the name used in their config hash.
ALTER TABLE commerce.package_profile ADD COLUMN IF NOT EXISTS catalog_display_name text;

UPDATE commerce.package_profile AS p
SET catalog_display_name = n.label
FROM (VALUES ('ACTIVE_QUARTER','重銷（三個月）'), ('ACTIVE_HALF_YEAR','重銷（六個月）'),
             ('ACTIVE_YEAR','重銷（十二個月）')) AS n(code,label)
WHERE p.stable_code = n.code AND p.package_class = 'ACTIVE_DURATION'
  AND p.catalog_display_name IS DISTINCT FROM n.label;

CREATE OR REPLACE VIEW commerce.package_version_display AS
SELECT v.package_profile_version_id, p.stable_code,
       coalesce(p.catalog_display_name, v.display_name) AS display_name
FROM commerce.package_profile_version v JOIN commerce.package_profile p USING(package_profile_id);

CREATE OR REPLACE VIEW commerce.package_purchase_display AS
SELECT s.package_purchase_snapshot_id, s.package_code,
       coalesce(p.catalog_display_name, s.package_name) AS package_name
FROM commerce.package_purchase_snapshot s
JOIN commerce.package_profile_version v USING(package_profile_version_id)
JOIN commerce.package_profile p USING(package_profile_id);

CREATE OR REPLACE FUNCTION commerce.set_purchase_catalog_name() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE label text;
BEGIN
  SELECT catalog_display_name INTO label FROM commerce.package_profile WHERE stable_code = NEW.package_code;
  NEW.package_name := coalesce(label, NEW.package_name);
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS set_purchase_catalog_name ON commerce.package_purchase_snapshot;
CREATE TRIGGER set_purchase_catalog_name BEFORE INSERT ON commerce.package_purchase_snapshot
FOR EACH ROW EXECUTE FUNCTION commerce.set_purchase_catalog_name();

UPDATE subscription.subscription_plan AS plan
SET display_name = n.label
FROM (VALUES ('QUARTER',3,'重銷（三個月）'), ('HALF_YEAR',6,'重銷（六個月）'),
             ('YEAR',12,'重銷（十二個月）')) AS n(code,months,label)
WHERE plan.plan_code IN (n.code, 'PO_20261019_ACTIVE_' || n.code)
  AND plan.duration_months=n.months AND plan.display_name IS DISTINCT FROM n.label;

DO $faq$
BEGIN
  IF to_regclass('content.faq_item') IS NOT NULL THEN
    UPDATE content.faq_item SET question='重銷（三個月）、重銷（六個月）與重銷（十二個月）如何認列？',
      keywords='重銷（三個月） 重銷（六個月） 重銷（十二個月） 分月 首期 1日 1200 2000 排程'
    WHERE question='季、半年、年重銷套組如何認列？';
  END IF;
END
$faq$;
COMMIT;
