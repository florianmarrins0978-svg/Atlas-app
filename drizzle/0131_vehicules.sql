-- LES VÉHICULES DE L'ENTREPRISE — sa planche du 14 octobre 2026, la troisième
-- (`appli/vehicules-plus-simple.html`).
--
-- Pour chaque camion : ses trois papiers (carte grise, assurance, procès-verbal
-- du contrôle technique) déposés en photo ou en PDF, ce qu'Atlas y a lu, et les
-- dates limites des contrôles, qui posent les rappels de l'accueil.
--
-- **Les dates sont RECOPIÉES du procès-verbal, jamais calculées** : une date
-- devinée fausse ferait rater le contrôle (`src/lib/vehicules.ts`).
--
-- `sources` dit d'où vient chaque case (« d'après la carte grise ») ; une case
-- corrigée à la main la perd.
--
-- Un papier remplacé garde son ancien fichier dans le stockage, comme
-- l'attestation décennale : seul le dernier est nommé ici.
--
-- Expand seul : une table neuve, aucune ligne existante touchée, aucune
-- contrainte posée sur une table habitée. Le code d'avant l'ignore.
CREATE TABLE IF NOT EXISTS "vehicules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "nom" text NOT NULL,
  "plaque" text,
  "modele" text,
  "ptac_kg" integer CHECK ("ptac_kg" BETWEEN 500 AND 44000),
  "genre" text,
  "assureur" text,
  "numero_contrat" text,
  "assistance" text,
  "controle_technique_avant" date,
  "pollution_avant" date,
  "contre_visite_avant" date,
  "sources" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "carte_grise_cle" text,
  "carte_grise_le" timestamptz,
  "assurance_cle" text,
  "assurance_le" timestamptz,
  "controle_cle" text,
  "controle_le" timestamptz,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "vehicules_entreprise_idx" ON "vehicules" ("entreprise_id") WHERE "deleted_at" IS NULL;

ALTER TABLE "vehicules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vehicules" FORCE ROW LEVEL SECURITY;

CREATE POLICY "vehicules_isolation" ON "vehicules"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "vehicules" TO atlas_app;

COMMENT ON TABLE "vehicules" IS 'Les véhicules de l''entreprise, leurs papiers et les dates limites de leurs contrôles (14 octobre 2026).';
