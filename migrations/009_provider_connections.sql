BEGIN;
CREATE TABLE provider_connections (
 cave_id uuid NOT NULL REFERENCES caves(id),id uuid NOT NULL,provider text NOT NULL CHECK(provider='microsoft365'),
 profile text NOT NULL DEFAULT 'm365_own' CHECK(profile='m365_own'),synthetic boolean NOT NULL,
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 160),version integer NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 100000),
 authorization_version integer NOT NULL DEFAULT 1 CHECK(authorization_version BETWEEN 1 AND 100000),
 status text NOT NULL CHECK(status IN ('oauth_pending','selection_required','unqualified','active','consent_denied','admin_consent_required','reconnect_required','error','revoked')),
 provider_tenant_id uuid,provider_account_id uuid,display_name text CHECK(length(display_name)<=160),username text CHECK(length(username)<=254),
 mailbox_id text CHECK(length(mailbox_id) BETWEEN 1 AND 2048),calendar_id text CHECK(length(calendar_id) BETWEEN 1 AND 2048),
 mailbox_kind text GENERATED ALWAYS AS ('mailbox'::text) STORED,calendar_kind text GENERATED ALWAYS AS ('calendar'::text) STORED,
 expires_at timestamptz,last_checked_at timestamptz,last_success_at timestamptz,last_error text CHECK(length(last_error)<=80),
 missing_resources jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(missing_resources)='array' AND octet_length(missing_resources::text)<=100),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(cave_id,id),UNIQUE(cave_id,id,authorization_version),UNIQUE(cave_id,id,provider_tenant_id,provider_account_id),UNIQUE(cave_id,id,provider_account_id),
 FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id),
 CHECK((provider_tenant_id IS NULL)=(provider_account_id IS NULL)),CHECK(status<>'active' OR (synthetic AND provider_account_id IS NOT NULL AND expires_at IS NOT NULL AND (mailbox_id IS NOT NULL OR calendar_id IS NOT NULL)))
);
CREATE TABLE provider_resources (
 cave_id uuid NOT NULL,connection_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('mailbox','calendar')),id text NOT NULL CHECK(length(id) BETWEEN 1 AND 2048),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 400),owner_id uuid NOT NULL,writable boolean NOT NULL DEFAULT false,discovered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(cave_id,connection_id,kind,id),FOREIGN KEY(cave_id,connection_id) REFERENCES provider_connections(cave_id,id),
 FOREIGN KEY(cave_id,connection_id,owner_id) REFERENCES provider_connections(cave_id,id,provider_account_id) DEFERRABLE INITIALLY DEFERRED,
 CHECK(writable=false)
);
ALTER TABLE provider_connections ADD FOREIGN KEY(cave_id,id,mailbox_kind,mailbox_id) REFERENCES provider_resources(cave_id,connection_id,kind,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE provider_connections ADD FOREIGN KEY(cave_id,id,calendar_kind,calendar_id) REFERENCES provider_resources(cave_id,connection_id,kind,id) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE provider_credentials (
 cave_id uuid NOT NULL,connection_id uuid NOT NULL,authorization_version integer NOT NULL,ciphertext text NOT NULL CHECK(length(ciphertext) BETWEEN 29 AND 4000000),
 PRIMARY KEY(cave_id,connection_id),FOREIGN KEY(cave_id,connection_id,authorization_version) REFERENCES provider_connections(cave_id,id,authorization_version) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE provider_oauth_attempts (
 cave_id uuid NOT NULL,connection_id uuid NOT NULL,id uuid NOT NULL,state_hash text NOT NULL UNIQUE CHECK(state_hash ~ '^[a-f0-9]{64}$'),
 actor_id uuid NOT NULL,session_hash text NOT NULL CHECK(session_hash ~ '^[a-f0-9]{64}$'),authorization_version integer NOT NULL,
 encrypted_flow text CHECK(length(encrypted_flow) BETWEEN 29 AND 16384),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),consumed_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','consumed','succeeded','failed','cancelled')),
 PRIMARY KEY(cave_id,connection_id,id),FOREIGN KEY(cave_id,connection_id) REFERENCES provider_connections(cave_id,id),FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id),
 CHECK(status<>'pending' OR encrypted_flow IS NOT NULL)
);
CREATE INDEX provider_oauth_actor ON provider_oauth_attempts(cave_id,actor_id,created_at);
CREATE TABLE provider_connection_commands (
 cave_id uuid NOT NULL,actor_id uuid NOT NULL,request_key uuid NOT NULL,connection_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('begin','select','inspect','activate','disconnect')),payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=4096),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(cave_id,actor_id,request_key),FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id),FOREIGN KEY(cave_id,connection_id) REFERENCES provider_connections(cave_id,id)
);
CREATE TABLE provider_connection_events (
 cave_id uuid NOT NULL,connection_id uuid NOT NULL,id uuid NOT NULL,actor_id uuid NOT NULL,version integer NOT NULL,authorization_version integer NOT NULL,
 kind text NOT NULL CHECK(length(kind)<=40),status text NOT NULL CHECK(length(status)<=40),diagnostic text CHECK(length(diagnostic)<=80),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(cave_id,connection_id,id),FOREIGN KEY(cave_id,connection_id) REFERENCES provider_connections(cave_id,id),FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE provider_routing_claims (
 cave_id uuid NOT NULL,connection_id uuid NOT NULL,provider text NOT NULL CHECK(provider='microsoft365'),provider_tenant_id uuid NOT NULL,provider_account_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('mailbox','calendar')),resource_id text NOT NULL,
 PRIMARY KEY(cave_id,connection_id,kind),UNIQUE(provider,provider_tenant_id,provider_account_id,kind,resource_id),
 FOREIGN KEY(cave_id,connection_id,provider_tenant_id,provider_account_id) REFERENCES provider_connections(cave_id,id,provider_tenant_id,provider_account_id),
 FOREIGN KEY(cave_id,connection_id,kind,resource_id) REFERENCES provider_resources(cave_id,connection_id,kind,id) DEFERRABLE INITIALLY DEFERRED
);
CREATE FUNCTION provider_connection_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.cave_id,NEW.id,NEW.provider,NEW.profile,NEW.synthetic,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.cave_id,OLD.id,OLD.provider,OLD.profile,OLD.synthetic,OLD.created_by,OLD.created_at)
  OR (OLD.provider_account_id IS NOT NULL AND ROW(NEW.provider_tenant_id,NEW.provider_account_id) IS DISTINCT FROM ROW(OLD.provider_tenant_id,OLD.provider_account_id))
  OR NEW.version<>OLD.version+1 OR NEW.authorization_version<OLD.authorization_version OR NEW.authorization_version>OLD.authorization_version+1
 THEN RAISE EXCEPTION 'Provider connection identity or version is immutable' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_connection_integrity BEFORE UPDATE ON provider_connections FOR EACH ROW EXECUTE FUNCTION provider_connection_integrity();
CREATE TRIGGER provider_command_immutable BEFORE UPDATE OR DELETE ON provider_connection_commands FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER provider_event_immutable BEFORE UPDATE OR DELETE ON provider_connection_events FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
INSERT INTO schema_migrations(version) VALUES(9);
COMMIT;
