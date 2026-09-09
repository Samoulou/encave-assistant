BEGIN;
-- No fixtures here. All cross-object relationships include the internal cave.
CREATE TABLE inquiries (
  cave_id uuid NOT NULL REFERENCES caves(id), id uuid NOT NULL,
  local_reference text NOT NULL CHECK(length(local_reference) BETWEEN 1 AND 80),
  channel text NOT NULL CHECK(channel IN ('manual','form','email')),
  contact_name text NOT NULL CHECK(length(contact_name) BETWEEN 1 AND 160),
  contact_email text CHECK(length(contact_email) BETWEEN 3 AND 254),
  subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 240),
  state text NOT NULL DEFAULT 'received' CHECK(state IN ('received','qualifying','waiting_customer','ready','processed','archived')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,local_reference),
  FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE messages (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, id uuid NOT NULL,
  direction text NOT NULL CHECK(direction IN ('inbound','outbound','internal')),
  channel text NOT NULL CHECK(channel IN ('manual','form','email')),
  body text NOT NULL CHECK(octet_length(body) BETWEEN 1 AND 1048576),
  author_observed text NOT NULL CHECK(length(author_observed) BETWEEN 1 AND 254),
  occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,inquiry_id,id),
  FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiries(cave_id,id),
  FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE proposals (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, id uuid NOT NULL,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,inquiry_id,id),
  FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiries(cave_id,id),
  FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE proposal_versions (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, proposal_id uuid NOT NULL, id uuid NOT NULL,
  number integer NOT NULL CHECK(number > 0), version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','pending_approval','approved','sending','sent','accepted','refused','expired','replaced')),
  snapshot_schema integer NOT NULL DEFAULT 1 CHECK(snapshot_schema > 0),
  snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND snapshot<>'{}'::jsonb AND octet_length(snapshot::text)<=1048576),
  terms_hash text NOT NULL CHECK(terms_hash ~ '^[a-f0-9]{64}$'),
  valid_until timestamptz NOT NULL, sealed_at timestamptz,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,proposal_id,number), UNIQUE(cave_id,inquiry_id,id), UNIQUE(cave_id,inquiry_id,id,terms_hash),
  CHECK(valid_until>created_at),
  FOREIGN KEY(cave_id,inquiry_id,proposal_id) REFERENCES proposals(cave_id,inquiry_id,id),
  FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE FUNCTION protect_proposal_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.sealed_at IS NOT NULL THEN RAISE EXCEPTION 'sealed_terms_immutable' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  NEW.terms_hash := encode(sha256(convert_to(NEW.snapshot::text,'UTF8')),'hex');
  IF TG_OP='UPDATE' AND OLD.sealed_at IS NOT NULL THEN
    NEW.sealed_at := OLD.sealed_at;
    IF (to_jsonb(NEW)-ARRAY['state','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','version','updated_at']) THEN
      RAISE EXCEPTION 'sealed_terms_immutable' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.state<>'draft' THEN
    NEW.sealed_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER proposal_terms_guard BEFORE INSERT OR UPDATE OR DELETE ON proposal_versions FOR EACH ROW EXECUTE FUNCTION protect_proposal_terms();

CREATE TABLE acceptances (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, proposal_version_id uuid NOT NULL, terms_hash text NOT NULL, id uuid NOT NULL,
  source_kind text NOT NULL CHECK(source_kind IN ('message','link','manual')),
  source_message_id uuid, proof_reference text NOT NULL CHECK(length(proof_reference) BETWEEN 1 AND 256),
  respondent_observed text NOT NULL CHECK(length(respondent_observed) BETWEEN 1 AND 254),
  accepted_at timestamptz NOT NULL, recorded_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,inquiry_id,proposal_version_id,terms_hash,id),
  CHECK((source_kind='message' AND source_message_id IS NOT NULL) OR (source_kind<>'message' AND source_message_id IS NULL)),
  FOREIGN KEY(cave_id,inquiry_id,proposal_version_id,terms_hash) REFERENCES proposal_versions(cave_id,inquiry_id,id,terms_hash),
  FOREIGN KEY(cave_id,inquiry_id,source_message_id) REFERENCES messages(cave_id,inquiry_id,id),
  FOREIGN KEY(cave_id,recorded_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE proposal_approvals (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, proposal_version_id uuid NOT NULL, terms_hash text NOT NULL, id uuid NOT NULL,
  scope text NOT NULL CHECK(scope IN ('send','book_confirm')), acceptance_id uuid,
  actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), valid_until timestamptz NOT NULL,
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,inquiry_id,proposal_version_id,terms_hash,acceptance_id,id),
  CHECK(valid_until>created_at),
  CHECK((scope='send' AND acceptance_id IS NULL) OR (scope='book_confirm' AND acceptance_id IS NOT NULL)),
  FOREIGN KEY(cave_id,inquiry_id,proposal_version_id,terms_hash) REFERENCES proposal_versions(cave_id,inquiry_id,id,terms_hash),
  FOREIGN KEY(cave_id,inquiry_id,proposal_version_id,terms_hash,acceptance_id) REFERENCES acceptances(cave_id,inquiry_id,proposal_version_id,terms_hash,id),
  FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE bookings (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, proposal_version_id uuid NOT NULL, terms_hash text NOT NULL,
  acceptance_id uuid NOT NULL, booking_approval_id uuid NOT NULL, id uuid NOT NULL,
  state text NOT NULL DEFAULT 'preparing' CHECK(state IN ('preparing','sync_pending','confirmed','reconciliation_required','change_requested','cancelled')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,inquiry_id,id), UNIQUE(cave_id,inquiry_id,id,proposal_version_id),
  FOREIGN KEY(cave_id,inquiry_id,proposal_version_id,terms_hash,acceptance_id) REFERENCES acceptances(cave_id,inquiry_id,proposal_version_id,terms_hash,id),
  FOREIGN KEY(cave_id,inquiry_id,proposal_version_id,terms_hash,acceptance_id,booking_approval_id) REFERENCES proposal_approvals(cave_id,inquiry_id,proposal_version_id,terms_hash,acceptance_id,id),
  FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE actions (
  cave_id uuid NOT NULL, inquiry_id uuid NOT NULL, id uuid NOT NULL,
  proposal_version_id uuid, booking_id uuid,
  kind text NOT NULL CHECK(length(kind) BETWEEN 1 AND 80),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
  payload_version integer NOT NULL DEFAULT 1 CHECK(payload_version>0),
  state text NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','running','succeeded','failed','uncertain','abandoned')),
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  result_code text CHECK(length(result_code) BETWEEN 1 AND 80),
  requested_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,id), UNIQUE(cave_id,idempotency_key),
  CHECK(booking_id IS NULL OR proposal_version_id IS NOT NULL),
  FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiries(cave_id,id),
  FOREIGN KEY(cave_id,inquiry_id,proposal_version_id) REFERENCES proposal_versions(cave_id,inquiry_id,id),
  FOREIGN KEY(cave_id,inquiry_id,booking_id,proposal_version_id) REFERENCES bookings(cave_id,inquiry_id,id,proposal_version_id),
  FOREIGN KEY(cave_id,requested_by) REFERENCES members(cave_id,identity_id)
);
CREATE INDEX messages_inquiry ON messages(cave_id,inquiry_id,occurred_at,id);
CREATE INDEX proposals_inquiry ON proposals(cave_id,inquiry_id);
CREATE INDEX actions_inquiry ON actions(cave_id,inquiry_id,created_at,id);
CREATE INDEX acceptances_version ON acceptances(cave_id,proposal_version_id);
CREATE FUNCTION require_sealed_terms() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE frozen timestamptz;
BEGIN
  SELECT sealed_at INTO frozen FROM proposal_versions WHERE cave_id=NEW.cave_id AND inquiry_id=NEW.inquiry_id AND id=NEW.proposal_version_id FOR KEY SHARE;
  IF FOUND AND frozen IS NULL THEN RAISE EXCEPTION 'terms_must_be_sealed' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER acceptance_terms_guard BEFORE INSERT ON acceptances FOR EACH ROW EXECUTE FUNCTION require_sealed_terms();
CREATE TRIGGER approval_terms_guard BEFORE INSERT ON proposal_approvals FOR EACH ROW EXECUTE FUNCTION require_sealed_terms();
INSERT INTO schema_migrations(version) VALUES(3);
COMMIT;
