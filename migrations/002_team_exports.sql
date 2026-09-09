BEGIN;
CREATE TABLE team_exports (
  cave_id uuid NOT NULL REFERENCES caves(id),
  id uuid NOT NULL,
  requested_by uuid NOT NULL,
  membership_version integer NOT NULL CHECK(membership_version>0),
  request_key uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','refused','failed')),
  content text,
  error_code text CHECK(error_code IN ('access_changed','export_expired','export_limit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(cave_id,id),
  UNIQUE(cave_id,id,requested_by,membership_version),
  UNIQUE(cave_id,requested_by,request_key),
  FOREIGN KEY(cave_id,requested_by) REFERENCES members(cave_id,identity_id),
  CHECK((state='ready') OR content IS NULL),
  CHECK(content IS NULL OR octet_length(content)<=1048576)
);
CREATE TABLE team_export_jobs (
  id uuid PRIMARY KEY,
  cave_id uuid NOT NULL,
  export_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  membership_version integer NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(cave_id,export_id),
  FOREIGN KEY(cave_id,export_id,requested_by,membership_version)
    REFERENCES team_exports(cave_id,id,requested_by,membership_version)
);
CREATE INDEX team_export_jobs_pending ON team_export_jobs(created_at,id) WHERE state='pending';
INSERT INTO schema_migrations(version) VALUES (2);
COMMIT;
