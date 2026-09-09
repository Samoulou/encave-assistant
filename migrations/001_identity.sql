-- Product identity only. Migration owner and application login are distinct.
CREATE TABLE schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE identities (
  id uuid PRIMARY KEY,
  issuer text NOT NULL,
  subject text NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issuer, subject)
);
CREATE TABLE caves (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE members (
  cave_id uuid NOT NULL REFERENCES caves(id),
  identity_id uuid NOT NULL REFERENCES identities(id),
  role text NOT NULL CHECK(role IN ('admin', 'operator', 'reader')),
  revoked_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  PRIMARY KEY(cave_id, identity_id)
);
CREATE TABLE app_sessions (
  token_hash text PRIMARY KEY CHECK(length(token_hash) = 64),
  identity_id uuid NOT NULL REFERENCES identities(id),
  active_cave_id uuid REFERENCES caves(id),
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE login_attempts (
  state_hash text PRIMARY KEY CHECK(length(state_hash) = 64),
  browser_hash text NOT NULL CHECK(length(browser_hash) = 64),
  encrypted_flow text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE invitations (
  id uuid PRIMARY KEY,
  cave_id uuid NOT NULL REFERENCES caves(id),
  invited_by uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK(role IN ('admin', 'operator', 'reader')),
  token_hash text NOT NULL UNIQUE CHECK(length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(cave_id, invited_by) REFERENCES members(cave_id, identity_id)
);
CREATE UNIQUE INDEX invitations_pending_email ON invitations(cave_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE identity_audit (
  id uuid PRIMARY KEY,
  cave_id uuid NOT NULL REFERENCES caves(id),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('invite', 'accept_invitation', 'revoke_member', 'revoke_invitation')),
  subject_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(cave_id, actor_id) REFERENCES members(cave_id, identity_id)
);
INSERT INTO schema_migrations(version) VALUES (1);
