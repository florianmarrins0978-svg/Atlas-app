CREATE TABLE "catalogue_prestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nom_canonique" text NOT NULL,
  "variantes" text[] NOT NULL DEFAULT '{}'::text[],
  "synonymes" text[] NOT NULL DEFAULT '{}'::text[],
  "description" text,
  "categorie" text,
  "unite" text,
  "actif" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalogue_prestations_nom_unique" UNIQUE ("nom_canonique")
);

CREATE TABLE "catalogue_materiels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nom_canonique" text NOT NULL,
  "variantes" text[] NOT NULL DEFAULT '{}'::text[],
  "categorie" text,
  "unite" text,
  "actif" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "catalogue_materiels_nom_unique" UNIQUE ("nom_canonique")
);

CREATE TABLE "historique_prix" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "prestation_id" uuid REFERENCES "catalogue_prestations"("id") ON DELETE SET NULL,
  "prix" numeric(10, 2) NOT NULL,
  "origine" text NOT NULL DEFAULT 'manuel' CHECK ("origine" IN ('devis', 'manuel', 'import')),
  "devis_id_origine" uuid,
  "constate_le" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "historique_prix_entreprise_prestation_idx" ON "historique_prix" ("entreprise_id", "prestation_id");

-- RLS : uniquement sur historique_prix (données propres à une société).
-- catalogue_prestations / catalogue_materiels restent des tables de référence
-- partagées, sans RLS, conformément au lot IA-05 ("les sociétés partagent le
-- catalogue canonique").
ALTER TABLE "historique_prix" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historique_prix" FORCE ROW LEVEL SECURITY;

CREATE POLICY "historique_prix_isolation" ON "historique_prix"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "catalogue_prestations" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "catalogue_materiels" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "historique_prix" TO atlas_app;
