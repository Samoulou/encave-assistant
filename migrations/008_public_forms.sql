BEGIN;
CREATE TABLE public_forms (
 cave_id uuid NOT NULL REFERENCES caves(id),id uuid NOT NULL UNIQUE,current_version integer NOT NULL CHECK(current_version BETWEEN 1 AND 10000),
 PRIMARY KEY(cave_id,id),UNIQUE(cave_id)
);
CREATE TABLE public_form_versions (
 cave_id uuid NOT NULL,form_id uuid NOT NULL,number integer NOT NULL CHECK(number BETWEEN 1 AND 10000),enabled boolean NOT NULL,
 definition jsonb NOT NULL CHECK(jsonb_typeof(definition)='object' AND octet_length(definition::text)<=8192),
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(cave_id,form_id,number),
 FOREIGN KEY(cave_id,form_id) REFERENCES public_forms(cave_id,id),FOREIGN KEY(cave_id,created_by) REFERENCES members(cave_id,identity_id)
);
ALTER TABLE public_forms ADD FOREIGN KEY(cave_id,id,current_version) REFERENCES public_form_versions(cave_id,form_id,number) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public_form_rates (
 cave_id uuid NOT NULL,form_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('challenge','minute','hour')),
 used integer NOT NULL CHECK(used>0),expires_at timestamptz NOT NULL,PRIMARY KEY(cave_id,form_id,kind),
 FOREIGN KEY(cave_id,form_id) REFERENCES public_forms(cave_id,id)
);
CREATE TABLE public_form_challenges (
 cave_id uuid NOT NULL,form_id uuid NOT NULL,version integer NOT NULL,token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL CHECK(expires_at>issued_at),
 PRIMARY KEY(cave_id,form_id,token_hash),UNIQUE(cave_id,form_id,token_hash,version),FOREIGN KEY(cave_id,form_id,version) REFERENCES public_form_versions(cave_id,form_id,number)
);
CREATE TABLE public_form_intakes (
 cave_id uuid NOT NULL,inquiry_id uuid NOT NULL,form_id uuid NOT NULL,form_version integer NOT NULL,message_id uuid NOT NULL,
 token_hash text NOT NULL,request_key uuid NOT NULL,payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),
 contact_phone text CHECK(length(contact_phone) BETWEEN 6 AND 40),requested_date date CHECK(requested_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
 participants integer CHECK(participants BETWEEN 1 AND 100000),budget_minor integer CHECK(budget_minor BETWEEN 0 AND 1000000000),budget_basis text CHECK(budget_basis IN ('group','person')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(cave_id,inquiry_id),UNIQUE(cave_id,form_id,token_hash),UNIQUE(cave_id,form_id,request_key),
 CHECK((budget_minor IS NULL)=(budget_basis IS NULL)),
 FOREIGN KEY(cave_id,inquiry_id) REFERENCES inquiries(cave_id,id),FOREIGN KEY(cave_id,inquiry_id,message_id) REFERENCES messages(cave_id,inquiry_id,id),
 FOREIGN KEY(cave_id,form_id,form_version) REFERENCES public_form_versions(cave_id,form_id,number),
 FOREIGN KEY(cave_id,form_id,token_hash,form_version) REFERENCES public_form_challenges(cave_id,form_id,token_hash,version)
);
CREATE TABLE public_form_commands (
 cave_id uuid NOT NULL,actor_id uuid NOT NULL,request_key uuid NOT NULL,form_id uuid NOT NULL,version integer NOT NULL,
 payload_hash text NOT NULL CHECK(payload_hash ~ '^[a-f0-9]{64}$'),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(cave_id,actor_id,request_key),
 FOREIGN KEY(cave_id,actor_id) REFERENCES members(cave_id,identity_id),FOREIGN KEY(cave_id,form_id,version) REFERENCES public_form_versions(cave_id,form_id,number)
);
CREATE TRIGGER public_form_version_immutable BEFORE UPDATE OR DELETE ON public_form_versions FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER public_form_intake_immutable BEFORE UPDATE OR DELETE ON public_form_intakes FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER public_form_command_immutable BEFORE UPDATE OR DELETE ON public_form_commands FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
INSERT INTO schema_migrations(version) VALUES(8);
COMMIT;
