-- POUR MON COMPTABLE, LOT 7 : le comptable renvoie le dossier à corriger.
-- Sa demande du 27 octobre 2026 : « qu'il puisse nous le retourner à corriger
-- si besoin, un peu comme pour un devis ». Sa planche du même jour
-- (`appli/soignee/comptable-retour.html`).
--
-- Les lignes à reprendre sont déjà là : ce sont ses rejets (0145), et une ligne
-- reprise repasse chez lui « corrigée ». Cette table ne garde que le GESTE du
-- renvoi : quand, son mot, son adresse pour être prévenu, combien de lignes.
--
-- **EXPAND SEUL** : une table neuve, aucune ligne existante touchée.

CREATE TABLE IF NOT EXISTS "retours_comptable" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "dossier_id" uuid NOT NULL,
  "message" text CHECK ("message" IS NULL OR length("message") <= 1000),
  -- L'adresse que le comptable laisse pour être prévenu : le patron s'en sert
  -- dans SA messagerie (« Prévenir mon comptable »), Atlas n'y écrit jamais.
  "email" text CHECK ("email" IS NULL OR length("email") <= 200),
  "rejetees" integer NOT NULL CHECK ("rejetees" > 0),
  "renvoye_le" timestamptz NOT NULL DEFAULT now(),
  -- « J'ai vu » sur la carte de l'accueil : la seule colonne qui bouge.
  "vu_le" timestamptz,
  CONSTRAINT "retours_comptable_dossier_fk" FOREIGN KEY ("dossier_id", "entreprise_id")
    REFERENCES "dossiers_comptables"("id", "entreprise_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "retours_comptable_dossier_idx" ON "retours_comptable" ("entreprise_id", "dossier_id", "renvoye_le" DESC);

ALTER TABLE "retours_comptable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retours_comptable" FORCE ROW LEVEL SECURITY;
-- Le comptable écrit sous l'isolation ordinaire, comme ses verdicts et son
-- attestation (0145, 0151) : son jeton ouvre son envoi, qui pose l'entreprise.
CREATE POLICY "retours_comptable_isolation" ON "retours_comptable"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- Un renvoi ne se réécrit pas et ne s'efface pas : on retire les droits que
-- donnent les privilèges par défaut (0081), et l'on rend la seule colonne que
-- « J'ai vu » écrit.
GRANT SELECT, INSERT ON "retours_comptable" TO atlas_app;
REVOKE UPDATE, DELETE ON "retours_comptable" FROM atlas_app;
GRANT UPDATE ("vu_le") ON "retours_comptable" TO atlas_app;

COMMENT ON TABLE "retours_comptable" IS 'Le comptable renvoie le dossier à corriger, avec un mot : le geste seul, les lignes sont ses rejets (27 octobre 2026).';
