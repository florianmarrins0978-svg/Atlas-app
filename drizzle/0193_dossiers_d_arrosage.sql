-- LES DOSSIERS DU PLAN D'ARROSAGE : un plan enregistré, figé, dans un dossier.
--
-- Sa demande du 21 novembre 2026, et sa décision qui lève « aucune
-- persistance » (`ARCHITECTURE.md` §167 et §599) : *« si un artisan me
-- reproche un réseau qui ne se lève pas, ni lui ni moi ne pouvons montrer ce
-- que Cause lui a rendu »*. Planche `appli/arrosage-dossiers.html`, et son
-- « tu peux tout coder » du même soir.
--
--   · `dossiers_arrosage` : un nom choisi, et, s'il le veut, la fiche d'un
--     client qui existe déjà (sa réponse à la question 1). Un dossier
--     SUPPRIMÉ n'est pas effacé : il est OUBLIÉ (`oublie_le`). Son nom et son
--     lien partent aussitôt ; il ne reste que le calcul, cinq ans (réponse 2,
--     `docs/arrosage-dossiers.md`).
--
--   · `plans_arrosage` : une VERSION par enregistrement, jamais écrasée.
--     `saisie` (ce qu'il a saisi), `resultat` (ce que le calcul a rendu, au
--     serveur), `empreinte`, la photo du croquis et le PDF archivé.
--     `version_calcul` et `modele` ne servent jamais à l'écran : ils sauvent
--     une enquête, comme dans `diagnostics`.
--
--   · `dossiers_arrosage_a_purger` : la file qui efface un dossier oublié
--     cinq ans après. Le travail de fond n'a le contexte d'aucune entreprise ;
--     il l'emprunte à la file, comme pour les photos de diagnostic (0056).
--     Des identifiants et une date, aucune donnée d'artisan : c'est ce qui
--     l'exempte de RLS (`scripts/test-toute-table-est-cloisonnee.ts`).
--
-- **EXPAND SEUL** : trois tables neuves. Aucune ligne existante n'est lue ni
-- réécrite ; le code d'avant les ignore et tourne tel quel.

CREATE TABLE IF NOT EXISTS "dossiers_arrosage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "nom" text,
  "client_id" uuid,
  "oublie_le" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "dossiers_arrosage_id_entreprise_uk" UNIQUE ("id", "entreprise_id"),
  -- Le client est celui de la MÊME entreprise : la clé composée le garantit
  -- en base, quoi que le code oublie. Effacé, le client emporte le lien seul.
  CONSTRAINT "dossiers_arrosage_client_fk" FOREIGN KEY ("client_id", "entreprise_id")
    REFERENCES "clients"("id", "entreprise_id") ON DELETE SET NULL ("client_id"),
  -- Vivant, un dossier a un nom ; oublié, il n'en a plus, ni de client.
  CONSTRAINT "dossiers_arrosage_nom_ck" CHECK (
    ("oublie_le" IS NULL AND "nom" IS NOT NULL AND char_length(btrim("nom")) BETWEEN 1 AND 120)
    OR ("oublie_le" IS NOT NULL AND "nom" IS NULL AND "client_id" IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS "dossiers_arrosage_entreprise_idx" ON "dossiers_arrosage" ("entreprise_id", "updated_at");
CREATE INDEX IF NOT EXISTS "dossiers_arrosage_client_idx" ON "dossiers_arrosage" ("client_id");

CREATE TABLE IF NOT EXISTS "plans_arrosage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "dossier_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "saisie" jsonb NOT NULL,
  "resultat" jsonb NOT NULL,
  "empreinte" text NOT NULL,
  "resume" text NOT NULL,
  "photo_cle" text,
  "pdf_cle" text,
  "version_calcul" text NOT NULL,
  "modele" text,
  "enregistre_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "plans_arrosage_dossier_fk" FOREIGN KEY ("dossier_id", "entreprise_id")
    REFERENCES "dossiers_arrosage"("id", "entreprise_id") ON DELETE CASCADE,
  -- Une version ne s'écrase pas : deux enregistrements ne portent jamais le même numéro.
  CONSTRAINT "plans_arrosage_version_uk" UNIQUE ("dossier_id", "version"),
  CONSTRAINT "plans_arrosage_version_ck" CHECK ("version" >= 1)
);
CREATE INDEX IF NOT EXISTS "plans_arrosage_dossier_idx" ON "plans_arrosage" ("dossier_id", "version");

-- **Sous RLS** comme le reste : une entreprise ne voit que ses dossiers.
ALTER TABLE "dossiers_arrosage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dossiers_arrosage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dossiers_arrosage_isolation" ON "dossiers_arrosage";
CREATE POLICY "dossiers_arrosage_isolation" ON "dossiers_arrosage"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

ALTER TABLE "plans_arrosage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans_arrosage" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_arrosage_isolation" ON "plans_arrosage";
CREATE POLICY "plans_arrosage_isolation" ON "plans_arrosage"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Les droits par défaut donnent tout à `atlas_app` (0081) : on retire, puis on
-- rend ce qui sert. DELETE : la purge des traces de plus de cinq ans, et rien
-- d'autre (supprimer un dossier, c'est l'OUBLIER, par une mise à jour).
REVOKE ALL ON "dossiers_arrosage" FROM atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "dossiers_arrosage" TO atlas_app;
REVOKE ALL ON "plans_arrosage" FROM atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "plans_arrosage" TO atlas_app;

CREATE TABLE IF NOT EXISTS "dossiers_arrosage_a_purger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dossier_id" uuid NOT NULL REFERENCES "dossiers_arrosage"("id") ON DELETE CASCADE,
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "purger_le" timestamptz NOT NULL,
  "mis_en_file_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "dossiers_arrosage_a_purger_uk" UNIQUE ("dossier_id")
);
CREATE INDEX IF NOT EXISTS "dossiers_arrosage_a_purger_echeance_idx" ON "dossiers_arrosage_a_purger" ("purger_le");
GRANT SELECT, INSERT, UPDATE, DELETE ON "dossiers_arrosage_a_purger" TO atlas_app;
