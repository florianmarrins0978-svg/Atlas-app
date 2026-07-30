-- Brouillon d'informations structurées (lot Note vocale / Transcription).
--
-- Un brouillon par chantier, distinct des données métier validées
-- (prestations, materiel, chantiers.duree_prevue…) : tant qu'il n'est pas
-- confirmé, rien de ce qu'il contient n'existe pour le reste de l'application.
-- La transcription d'origine reste dans notes_vocales et n'est jamais
-- remplacée par ce brouillon — les deux sont consultables séparément.
--
-- `modifie_par_humain` est le garde-fou contre l'écrasement silencieux : dès
-- qu'un patron corrige une valeur, une nouvelle génération ne peut plus
-- remplacer le contenu sans un accord explicite (voir brouillon-service.ts).

CREATE TABLE "brouillons_informations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,
  "contenu" jsonb NOT NULL,
  "statut" text NOT NULL DEFAULT 'brouillon' CHECK ("statut" IN ('brouillon', 'confirme')),
  "modifie_par_humain" boolean NOT NULL DEFAULT false,
  -- Transcription ayant servi à produire ce brouillon : permet de savoir qu'il
  -- porte sur une version antérieure de la dictée, sans jamais la dupliquer
  -- comme source de vérité.
  "source_transcription" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "confirme_at" timestamptz,
  CONSTRAINT "brouillons_informations_chantier_uk" UNIQUE ("chantier_id"),
  CONSTRAINT "brouillons_informations_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE CASCADE
);

CREATE INDEX "brouillons_informations_entreprise_idx" ON "brouillons_informations" ("entreprise_id");

ALTER TABLE "brouillons_informations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brouillons_informations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "brouillons_informations_isolation" ON "brouillons_informations"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "brouillons_informations" TO atlas_app;
