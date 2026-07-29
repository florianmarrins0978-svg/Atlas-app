CREATE TABLE "parametres_chiffrage" (
  "entreprise_id" uuid PRIMARY KEY REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "cout_journalier_ouvrier" numeric(10, 2) NOT NULL DEFAULT '200.00',
  "cout_journalier_chef_equipe" numeric(10, 2) NOT NULL DEFAULT '280.00',
  "cout_deplacement" numeric(10, 2) NOT NULL DEFAULT '35.00',
  "marge_cible_pourcent" numeric(5, 2) NOT NULL DEFAULT '20.00',
  "taux_tva_defaut" numeric(5, 2) NOT NULL DEFAULT '20.00',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parametres_chiffrage_couts_non_negatifs CHECK (
    cout_journalier_ouvrier >= 0 AND cout_journalier_chef_equipe >= 0 AND cout_deplacement >= 0
  ),
  CONSTRAINT parametres_chiffrage_taux_valides CHECK (
    marge_cible_pourcent >= 0 AND taux_tva_defaut >= 0
  )
);

ALTER TABLE "parametres_chiffrage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parametres_chiffrage" FORCE ROW LEVEL SECURITY;

CREATE POLICY "parametres_chiffrage_isolation" ON "parametres_chiffrage"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "parametres_chiffrage" TO atlas_app;
