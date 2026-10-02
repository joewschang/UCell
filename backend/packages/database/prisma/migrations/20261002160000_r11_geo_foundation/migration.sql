-- Additive, no change to Qualification ownership, monetary ledgers, or R1.0B rules.
CREATE TABLE organization.geo_admin_area (
 catalog_version text NOT NULL, country_code varchar(2) NOT NULL, area_code text NOT NULL,
 level text NOT NULL CHECK (level IN ('CITY','DISTRICT')), parent_area_code text,
 area_name_zh text NOT NULL, area_name_en text, aliases jsonb NOT NULL DEFAULT '[]',
 region_group text NOT NULL CHECK (region_group IN ('NORTH','CENTRAL','SOUTH','EAST','ISLAND')),
 sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (catalog_version,country_code,area_code),
 FOREIGN KEY (catalog_version,country_code,parent_area_code) REFERENCES organization.geo_admin_area(catalog_version,country_code,area_code),
 CHECK ((level='CITY' AND parent_area_code IS NULL) OR (level='DISTRICT' AND parent_area_code IS NOT NULL)),
 CHECK (jsonb_typeof(aliases)='array')
);
CREATE INDEX geo_admin_area_catalog_version_country_code_parent_area_code_idx ON organization.geo_admin_area(catalog_version,country_code,parent_area_code);
CREATE TABLE organization.member_geo_profile (
 person_id uuid PRIMARY KEY REFERENCES identity.person(person_id) ON DELETE RESTRICT,
 country_code varchar(2) NOT NULL, city_code text, district_code text,
 geo_status text NOT NULL CHECK (geo_status IN ('PENDING','NORMALIZED','PARTIAL','FAILED','MANUAL_CONFIRMED')),
 reason text, address_hash varchar(64) NOT NULL CHECK (address_hash ~ '^[a-f0-9]{64}$'),
 hash_key_version text NOT NULL, catalog_version text NOT NULL, geo_source text NOT NULL,
 normalized_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 CHECK (district_code IS NULL OR city_code IS NOT NULL),
 CHECK (geo_status NOT IN ('NORMALIZED','MANUAL_CONFIRMED') OR (city_code IS NOT NULL AND district_code IS NOT NULL))
);
CREATE INDEX member_geo_profile_city_code_district_code_idx ON organization.member_geo_profile(city_code,district_code);
CREATE TABLE organization.member_geo_profile_event (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), person_id uuid NOT NULL REFERENCES identity.person(person_id) ON DELETE RESTRICT,
 source_event_id uuid NOT NULL UNIQUE, country_code varchar(2) NOT NULL, city_code text, district_code text,
 geo_status text NOT NULL CHECK (geo_status IN ('PENDING','NORMALIZED','PARTIAL','FAILED','MANUAL_CONFIRMED')),
 reason text, address_hash varchar(64) NOT NULL CHECK (address_hash ~ '^[a-f0-9]{64}$'),
 hash_key_version text NOT NULL, catalog_version text NOT NULL, geo_source text NOT NULL,
 effective_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK (district_code IS NULL OR city_code IS NOT NULL),
 CHECK (geo_status NOT IN ('NORMALIZED','MANUAL_CONFIRMED') OR (city_code IS NOT NULL AND district_code IS NOT NULL))
);
CREATE INDEX member_geo_profile_event_person_id_effective_at_recorded_at_idx ON organization.member_geo_profile_event(person_id,effective_at,recorded_at);
CREATE FUNCTION organization.reject_geo_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'member_geo_profile_event is append-only'; END; $$;
CREATE TRIGGER member_geo_profile_event_immutable BEFORE UPDATE OR DELETE ON organization.member_geo_profile_event FOR EACH ROW EXECUTE FUNCTION organization.reject_geo_event_mutation();
COMMENT ON TABLE organization.member_geo_profile IS 'R1.1 normalized administrative geography only; no street address, phone, email, or precise coordinates';
COMMENT ON COLUMN organization.member_geo_profile.address_hash IS 'Keyed HMAC of normalized source address; key remains outside database; rotation uses hash_key_version';
