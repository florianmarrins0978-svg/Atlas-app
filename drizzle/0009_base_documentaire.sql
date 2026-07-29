CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid,
  "type_document" text NOT NULL CHECK ("type_document" IN ('devis', 'transcription', 'photo', 'note', 'autre')),
  "titre" text NOT NULL,
  "source_reference_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "documents_entreprise_chantier_idx" ON "documents" ("entreprise_id", "chantier_id");

CREATE TABLE "fragments_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "contenu" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "fragments_documents_entreprise_document_idx" ON "fragments_documents" ("entreprise_id", "document_id");

ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fragments_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fragments_documents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "documents_isolation" ON "documents"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

CREATE POLICY "fragments_documents_isolation" ON "fragments_documents"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "documents" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "fragments_documents" TO atlas_app;
