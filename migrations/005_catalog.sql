BEGIN;
CREATE TABLE catalog_offers (
  cave_id uuid NOT NULL REFERENCES caves(id), id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  latest_number integer NOT NULL DEFAULT 1 CHECK(latest_number BETWEEN 1 AND 10000), published_version_id uuid,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE catalog_offer_versions (
  cave_id uuid NOT NULL, offer_id uuid NOT NULL, id uuid NOT NULL, number integer NOT NULL CHECK(number BETWEEN 1 AND 10000),
  schema_version integer NOT NULL CHECK(schema_version=1), title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  category text NOT NULL CHECK(category IN ('activity_fixed','room_quote','event_info')),
  minimum_participants integer CHECK(minimum_participants BETWEEN 1 AND 100000), maximum_participants integer CHECK(maximum_participants BETWEEN 1 AND 100000),
  duration_mode text NOT NULL CHECK(duration_mode IN ('fixed','variable','unknown')), duration_minutes integer CHECK(duration_minutes BETWEEN 1 AND 43200),
  amount_minor integer CHECK(amount_minor BETWEEN 0 AND 1000000000), currency text NOT NULL CHECK(currency='CHF'),
  price_unit text NOT NULL CHECK(price_unit IN ('per_person','per_group')),
  tax_mode text NOT NULL CHECK(tax_mode IN ('included','excluded','not_applicable','unknown')),
  tax_rate_basis_points integer CHECK(tax_rate_basis_points BETWEEN 0 AND 10000), tax_label text CHECK(length(tax_label) BETWEEN 1 AND 240),
  conditions text CHECK(length(conditions) BETWEEN 1 AND 2000),
  source_label text CHECK(length(source_label) BETWEEN 1 AND 160), source_reference text CHECK(length(source_reference) BETWEEN 1 AND 1024),
  source_verified_at timestamptz, source_valid_until timestamptz, official_url text CHECK(length(official_url) BETWEEN 1 AND 2048 AND official_url LIKE 'https://%'),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,offer_id,id), UNIQUE(cave_id,offer_id,number),
  FOREIGN KEY(cave_id,offer_id) REFERENCES catalog_offers(cave_id,id), FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id),
  CHECK(minimum_participants<=maximum_participants),
  CHECK(duration_mode='fixed' OR duration_minutes IS NULL),
  CHECK(category<>'activity_fixed' OR duration_mode<>'variable'), CHECK(category<>'room_quote' OR duration_mode<>'fixed'),
  CHECK(tax_mode<>'unknown' OR (tax_rate_basis_points IS NULL AND tax_label IS NULL)),
  CHECK(tax_mode<>'not_applicable' OR tax_rate_basis_points IS NULL OR tax_rate_basis_points=0),
  CHECK((source_label IS NULL AND source_reference IS NULL AND source_verified_at IS NULL AND source_valid_until IS NULL) OR
    (source_label IS NOT NULL AND source_reference IS NOT NULL AND source_verified_at IS NOT NULL AND source_valid_until IS NOT NULL AND source_valid_until>source_verified_at))
);
CREATE TABLE catalog_approvals (
  cave_id uuid NOT NULL, offer_id uuid NOT NULL, version_id uuid NOT NULL, approved_by uuid NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,offer_id,version_id), FOREIGN KEY(cave_id,offer_id,version_id) REFERENCES catalog_offer_versions(cave_id,offer_id,id),
  FOREIGN KEY(cave_id,approved_by) REFERENCES members(cave_id,identity_id)
);
ALTER TABLE catalog_offers ADD FOREIGN KEY(cave_id,id,published_version_id) REFERENCES catalog_approvals(cave_id,offer_id,version_id);
CREATE TABLE catalog_commands (
  cave_id uuid NOT NULL, actor_id uuid NOT NULL, request_key uuid NOT NULL, offer_id uuid NOT NULL,
  operation text NOT NULL CHECK(operation IN ('create','revise','publish','enable')),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=16384),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(cave_id,actor_id,request_key),
  FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id), FOREIGN KEY(cave_id,offer_id) REFERENCES catalog_offers(cave_id,id)
);
CREATE FUNCTION catalog_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'catalog_history_immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER catalog_version_guard BEFORE UPDATE OR DELETE ON catalog_offer_versions FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER catalog_approval_guard BEFORE UPDATE OR DELETE ON catalog_approvals FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER catalog_command_guard BEFORE UPDATE OR DELETE ON catalog_commands FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
INSERT INTO schema_migrations(version) VALUES(5);
COMMIT;
