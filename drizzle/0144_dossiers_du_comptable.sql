-- POUR MON COMPTABLE, LOT 3 — les dossiers arrêtés et le bilan du comptable.
-- Ses choix des 23 et 24 octobre 2026 (`TODO.md`, « Pour mon comptable ») :
--   · il arrête son dossier QUAND IL VEUT, à la date de son exercice ; le
--     suivant commence le lendemain ;
--   · le dossier devient un PDF, rangé dans « Mes dossiers justifiés », gardé
--     dix ans, et un dossier rangé ne s'efface pas ;
--   · le bilan que rend le comptable (e-mail ou papier) se range avec lui.
--
-- **EXPAND SEUL** : deux tables neuves, aucune ligne existante touchée.

CREATE TABLE IF NOT EXISTS "dossiers_comptables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "du" date NOT NULL,
  "au" date NOT NULL,
  -- Le PDF, dans le stockage, et son empreinte : dix ans plus tard, elle dit
  -- que le fichier est celui qui a été rangé, octet pour octet.
  "fichier_cle" text NOT NULL CHECK (length(btrim("fichier_cle")) > 0),
  "taille_octets" integer NOT NULL CHECK ("taille_octets" > 0),
  "empreinte" text NOT NULL CHECK (length("empreinte") = 64),
  -- Dix ans après la fin de l'exercice (Code de commerce, art. L123-22).
  "garde_jusqu_au" date NOT NULL,
  "arrete_par" uuid REFERENCES "users"("id"),
  "arrete_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "dossiers_comptables_periode_check" CHECK ("au" >= "du"),
  CONSTRAINT "dossiers_comptables_id_entreprise_uk" UNIQUE ("id", "entreprise_id")
);
-- Deux dossiers ne couvrent jamais le même jour : le suivant commence le
-- lendemain du précédent (`debutDuDossierEnCours`), et la base le tient.
CREATE UNIQUE INDEX IF NOT EXISTS "dossiers_comptables_du_uk" ON "dossiers_comptables" ("entreprise_id", "du");
CREATE INDEX IF NOT EXISTS "dossiers_comptables_au_idx" ON "dossiers_comptables" ("entreprise_id", "au");

CREATE TABLE IF NOT EXISTS "bilans_comptables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "dossier_id" uuid NOT NULL,
  "fichier_cle" text NOT NULL CHECK (length(btrim("fichier_cle")) > 0),
  "fichier_nom" text,
  "nature" text NOT NULL CHECK ("nature" IN ('photo', 'pdf')),
  "taille_octets" integer NOT NULL CHECK ("taille_octets" > 0),
  "empreinte" text NOT NULL CHECK (length("empreinte") = 64),
  "ajoute_par" uuid REFERENCES "users"("id"),
  "ajoute_le" timestamptz NOT NULL DEFAULT now(),
  -- Le dossier de la MÊME entreprise, par la clé double.
  CONSTRAINT "bilans_comptables_dossier_fk" FOREIGN KEY ("dossier_id", "entreprise_id")
    REFERENCES "dossiers_comptables"("id", "entreprise_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "bilans_comptables_dossier_idx" ON "bilans_comptables" ("entreprise_id", "dossier_id");

ALTER TABLE "dossiers_comptables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dossiers_comptables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "dossiers_comptables_isolation" ON "dossiers_comptables"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- **Ni UPDATE ni DELETE pour l'application** : un dossier rangé ne se
-- réécrit pas et ne s'efface pas. Ce n'est pas l'écran qui le promet, c'est
-- la base qui le refuse. `ALTER DEFAULT PRIVILEGES` donne les quatre droits
-- à toute table neuve (voir 0081) : un GRANT ne suffit donc pas, il faut
-- retirer les deux autres (comme 0123).
GRANT SELECT, INSERT ON "dossiers_comptables" TO atlas_app;
REVOKE UPDATE, DELETE ON "dossiers_comptables" FROM atlas_app;

ALTER TABLE "bilans_comptables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bilans_comptables" FORCE ROW LEVEL SECURITY;
CREATE POLICY "bilans_comptables_isolation" ON "bilans_comptables"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- Un bilan se retire (une photo floue, le mauvais fichier) ; il ne se réécrit pas.
GRANT SELECT, INSERT, DELETE ON "bilans_comptables" TO atlas_app;
REVOKE UPDATE ON "bilans_comptables" FROM atlas_app;

COMMENT ON TABLE "dossiers_comptables" IS 'Les dossiers du comptable arrêtés par le patron, leur PDF gardé dix ans, jamais réécrits (24 octobre 2026).';
COMMENT ON TABLE "bilans_comptables" IS 'Le bilan rendu par le comptable, rangé avec son dossier (24 octobre 2026).';
