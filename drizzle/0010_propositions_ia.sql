CREATE TABLE "propositions_ia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,
  "type" text NOT NULL,
  "description" text NOT NULL,
  "donnees" jsonb NOT NULL,
  "statut" text NOT NULL DEFAULT 'proposee' CHECK ("statut" IN ('proposee', 'appliquee', 'expiree')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "appliquee_at" timestamptz
);
CREATE INDEX "propositions_ia_entreprise_chantier_idx" ON "propositions_ia" ("entreprise_id", "chantier_id");

ALTER TABLE "propositions_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "propositions_ia" FORCE ROW LEVEL SECURITY;

CREATE POLICY "propositions_ia_isolation" ON "propositions_ia"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "propositions_ia" TO atlas_app;
