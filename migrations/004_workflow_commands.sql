BEGIN;
CREATE TABLE workflow_commands (
  cave_id uuid NOT NULL REFERENCES caves(id), actor_id uuid NOT NULL, request_key uuid NOT NULL,
  record_kind text NOT NULL CHECK(record_kind IN ('inquiry','proposal','booking','action')), record_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
  result_state text NOT NULL CHECK(length(result_state) BETWEEN 1 AND 40), result_version integer NOT NULL CHECK(result_version>1),
  created_at timestamptz NOT NULL DEFAULT now(),
  inquiry_id uuid GENERATED ALWAYS AS (CASE WHEN record_kind='inquiry' THEN record_id END) STORED,
  proposal_id uuid GENERATED ALWAYS AS (CASE WHEN record_kind='proposal' THEN record_id END) STORED,
  booking_id uuid GENERATED ALWAYS AS (CASE WHEN record_kind='booking' THEN record_id END) STORED,
  action_id uuid GENERATED ALWAYS AS (CASE WHEN record_kind='action' THEN record_id END) STORED,
  PRIMARY KEY(cave_id,actor_id,request_key),
  UNIQUE(cave_id,actor_id,request_key,record_kind,record_id,result_state,result_version),
  FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id),
  FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiries(cave_id,id),
  FOREIGN KEY(cave_id,proposal_id) REFERENCES proposal_versions(cave_id,id),
  FOREIGN KEY(cave_id,booking_id) REFERENCES bookings(cave_id,id),
  FOREIGN KEY(cave_id,action_id) REFERENCES actions(cave_id,id)
);
CREATE TABLE workflow_events (
  id uuid PRIMARY KEY, cave_id uuid NOT NULL, actor_id uuid NOT NULL, request_key uuid NOT NULL,
  record_kind text NOT NULL, record_id uuid NOT NULL,
  from_state text NOT NULL CHECK(length(from_state) BETWEEN 1 AND 40), to_state text NOT NULL,
  from_version integer NOT NULL CHECK(from_version>0), to_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(to_version=from_version+1 AND from_state<>to_state),
  UNIQUE(cave_id,record_kind,record_id,to_version),
  FOREIGN KEY(cave_id,actor_id,request_key,record_kind,record_id,to_state,to_version)
    REFERENCES workflow_commands(cave_id,actor_id,request_key,record_kind,record_id,result_state,result_version)
);
CREATE INDEX workflow_events_record ON workflow_events(cave_id,record_kind,record_id,to_version);
INSERT INTO schema_migrations(version) VALUES(4);
COMMIT;
