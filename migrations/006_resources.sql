BEGIN;
CREATE TABLE resources (
  cave_id uuid NOT NULL REFERENCES caves(id), id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1 CHECK(version>0),
  latest_number integer NOT NULL DEFAULT 1 CHECK(latest_number BETWEEN 1 AND 10000), current_version_id uuid,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE resource_versions (
  cave_id uuid NOT NULL, resource_id uuid NOT NULL, id uuid NOT NULL, number integer NOT NULL CHECK(number BETWEEN 1 AND 10000),
  schema_version integer NOT NULL CHECK(schema_version=1), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  kind text NOT NULL CHECK(kind IN ('room','team','equipment')), time_zone text NOT NULL CHECK(length(time_zone) BETWEEN 1 AND 100),
  hours_mode text NOT NULL CHECK(hours_mode IN ('unknown','always','weekly')),
  weekly_hours jsonb NOT NULL CHECK(jsonb_typeof(weekly_hours)='array' AND jsonb_array_length(weekly_hours)<=42 AND octet_length(weekly_hours::text)<=8192),
  source_truth text NOT NULL CHECK(source_truth IN ('unknown','internal_controlled','microsoft_resource','external_uncontrolled')),
  source_policy text CHECK(length(source_policy) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,resource_id,id), UNIQUE(cave_id,resource_id,number),
  FOREIGN KEY(cave_id,resource_id) REFERENCES resources(cave_id,id), FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id),
  CHECK(hours_mode='weekly' OR weekly_hours='[]'::jsonb)
);
ALTER TABLE resources ADD FOREIGN KEY(cave_id,id,current_version_id) REFERENCES resource_versions(cave_id,resource_id,id);
CREATE TABLE resource_closures (
  cave_id uuid NOT NULL, resource_id uuid NOT NULL, id uuid NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  time_zone text NOT NULL CHECK(length(time_zone) BETWEEN 1 AND 100), start_local text NOT NULL, end_local text NOT NULL,
  start_offset text NOT NULL, end_offset text NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 240),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), cancelled_by uuid, cancelled_at timestamptz,
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,resource_id,id), FOREIGN KEY(cave_id,resource_id) REFERENCES resources(cave_id,id),
  FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id), FOREIGN KEY(cave_id,cancelled_by) REFERENCES members(cave_id,identity_id),
  CHECK(ends_at>starts_at AND ends_at-starts_at<=interval '366 days'), CHECK((cancelled_by IS NULL)=(cancelled_at IS NULL))
);
CREATE INDEX resource_closures_active ON resource_closures(cave_id,resource_id,starts_at,ends_at) WHERE cancelled_at IS NULL;
CREATE TABLE resource_plan_heads (
  cave_id uuid NOT NULL, offer_version_id uuid NOT NULL, version integer NOT NULL CHECK(version BETWEEN 1 AND 10000), current_plan_id uuid,
  PRIMARY KEY(cave_id,offer_version_id), FOREIGN KEY(cave_id,offer_version_id) REFERENCES catalog_offer_versions(cave_id,id)
);
CREATE TABLE resource_plans (
  cave_id uuid NOT NULL, offer_version_id uuid NOT NULL, id uuid NOT NULL, number integer NOT NULL CHECK(number BETWEEN 1 AND 10000), anchor_resource_id uuid NOT NULL,
  resource_ids uuid[] NOT NULL CHECK(array_ndims(resource_ids)=1 AND cardinality(resource_ids) BETWEEN 1 AND 20 AND array_position(resource_ids,NULL) IS NULL),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,offer_version_id,id), UNIQUE(cave_id,offer_version_id,number),
  FOREIGN KEY(cave_id,offer_version_id) REFERENCES resource_plan_heads(cave_id,offer_version_id),
  FOREIGN KEY(cave_id,anchor_resource_id) REFERENCES resources(cave_id,id), FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id),
  CHECK(anchor_resource_id=ANY(resource_ids))
);
CREATE TABLE resource_plan_rules (
  cave_id uuid NOT NULL, plan_id uuid NOT NULL, resource_id uuid NOT NULL,
  before_minutes integer NOT NULL CHECK(before_minutes BETWEEN 0 AND 1440), after_minutes integer NOT NULL CHECK(after_minutes BETWEEN 0 AND 1440),
  PRIMARY KEY(cave_id,plan_id,resource_id), FOREIGN KEY(cave_id,plan_id) REFERENCES resource_plans(cave_id,id),
  FOREIGN KEY(cave_id,resource_id) REFERENCES resources(cave_id,id)
);
ALTER TABLE resource_plan_heads ADD FOREIGN KEY(cave_id,offer_version_id,current_plan_id) REFERENCES resource_plans(cave_id,offer_version_id,id);
ALTER TABLE resource_plans ADD FOREIGN KEY(cave_id,id,anchor_resource_id) REFERENCES resource_plan_rules(cave_id,plan_id,resource_id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE resource_commands (
  cave_id uuid NOT NULL, actor_id uuid NOT NULL, request_key uuid NOT NULL, resource_id uuid, offer_version_id uuid,
  operation text NOT NULL CHECK(operation IN ('create','revise','enable','close','cancel_closure','plan')),
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'), result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=16384),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(cave_id,actor_id,request_key),
  FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id), FOREIGN KEY(cave_id,resource_id) REFERENCES resources(cave_id,id),
  FOREIGN KEY(cave_id,offer_version_id) REFERENCES catalog_offer_versions(cave_id,id),
  CHECK((operation='plan' AND offer_version_id IS NOT NULL AND resource_id IS NULL) OR (operation<>'plan' AND resource_id IS NOT NULL AND offer_version_id IS NULL))
);
CREATE TRIGGER resource_version_guard BEFORE UPDATE OR DELETE ON resource_versions FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER resource_plan_guard BEFORE UPDATE OR DELETE ON resource_plans FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER resource_plan_rule_guard BEFORE UPDATE OR DELETE ON resource_plan_rules FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE FUNCTION check_resource_plan_member() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE declared uuid[];
BEGIN
  SELECT resource_ids INTO declared FROM resource_plans WHERE cave_id=NEW.cave_id AND id=NEW.plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'resource_plan_unavailable' USING ERRCODE='23503'; END IF;
  IF NOT NEW.resource_id=ANY(declared) THEN RAISE EXCEPTION 'resource_plan_composition_immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER resource_plan_member_guard BEFORE INSERT ON resource_plan_rules FOR EACH ROW EXECUTE FUNCTION check_resource_plan_member();
CREATE FUNCTION check_resource_plan_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM resource_plan_rules WHERE cave_id=NEW.cave_id AND plan_id=NEW.id)<>cardinality(NEW.resource_ids) THEN
    RAISE EXCEPTION 'resource_plan_incomplete' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER resource_plan_complete AFTER INSERT ON resource_plans DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_resource_plan_complete();
CREATE TRIGGER resource_command_guard BEFORE UPDATE OR DELETE ON resource_commands FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE FUNCTION protect_resource_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'closure_history_immutable' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW)-ARRAY['cancelled_by','cancelled_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['cancelled_by','cancelled_at']) OR NEW.cancelled_at IS NULL THEN
    RAISE EXCEPTION 'closure_history_immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER resource_closure_guard BEFORE UPDATE OR DELETE ON resource_closures FOR EACH ROW EXECUTE FUNCTION protect_resource_closure();
INSERT INTO schema_migrations(version) VALUES(6);
COMMIT;
