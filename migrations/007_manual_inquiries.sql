BEGIN;
CREATE TABLE inquiry_intakes (
  cave_id uuid NOT NULL,inquiry_id uuid NOT NULL,message_id uuid NOT NULL,actor_id uuid NOT NULL,
  actor_name text NOT NULL CHECK(length(actor_name)>0),origin text NOT NULL CHECK(origin IN ('phone','in_person','other')),
  contact_phone text CHECK(length(contact_phone) BETWEEN 6 AND 40),requested_date date CHECK(requested_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  participants integer CHECK(participants BETWEEN 1 AND 100000),budget_minor integer CHECK(budget_minor BETWEEN 0 AND 1000000000),
  budget_basis text CHECK(budget_basis IN ('group','person')),currency text NOT NULL DEFAULT 'CHF' CHECK(currency='CHF'),
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(cave_id,inquiry_id),
  CHECK((budget_minor IS NULL)=(budget_basis IS NULL)),
  FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiries(cave_id,id),
  FOREIGN KEY(cave_id,inquiry_id,message_id) REFERENCES messages(cave_id,inquiry_id,id),
  FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id)
);
CREATE TABLE inquiry_commands (
  cave_id uuid NOT NULL,actor_id uuid NOT NULL,request_key uuid NOT NULL,inquiry_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(cave_id,actor_id,request_key),FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id),
  FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiry_intakes(cave_id,inquiry_id)
);
CREATE TRIGGER intake_immutable BEFORE UPDATE OR DELETE ON inquiry_intakes FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER inquiry_command_immutable BEFORE UPDATE OR DELETE ON inquiry_commands FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE INDEX inquiries_queue ON inquiries(cave_id,created_at,id);
INSERT INTO schema_migrations(version) VALUES(7);
COMMIT;
