-- UCell R1.0B REVIEW R5
-- Operations-ready metadata, integrity/reporting support, no physical document deletion.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='audit' AND t.typname='AttachmentStatus'
  ) THEN
    CREATE TYPE audit."AttachmentStatus" AS ENUM ('ACTIVE','SUPERSEDED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS audit.document_attachment (
  document_attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  document_type text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes >= 0),
  sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-fA-F]{64}$'),
  storage_provider text NOT NULL,
  object_key text NOT NULL,
  version_no integer NOT NULL DEFAULT 1 CHECK(version_no > 0),
  status audit."AttachmentStatus" NOT NULL DEFAULT 'ACTIVE',
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  supersedes_id uuid REFERENCES audit.document_attachment(document_attachment_id),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_document_storage UNIQUE(storage_provider,object_key),
  CONSTRAINT uq_document_entity_type_version UNIQUE(entity_type,entity_id,document_type,version_no)
);

CREATE INDEX IF NOT EXISTS ix_document_attachment_entity
ON audit.document_attachment(entity_type,entity_id,status,uploaded_at);

CREATE INDEX IF NOT EXISTS ix_document_attachment_sha256
ON audit.document_attachment(sha256);

CREATE TRIGGER trg_document_attachment_no_delete
BEFORE DELETE ON audit.document_attachment
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

COMMENT ON TABLE audit.document_attachment IS
'Immutable metadata for externally stored original forms/evidence. Bytes live in configured object storage or Drive; superseding creates a new version rather than deleting.';
