-- LA PLATEFORME DE FACTURE ÉLECTRONIQUE DE L'ARTISAN — ses choix du
-- 5 novembre 2026 sur `appli/soignee/reglages-facture-electronique.html` :
-- 1 A (Atlas fait la Factur-X, la plateforme la transmet), 2 A (il relie son
-- compte par ses identifiants), 3 B (rien ne part sans la plateforme).
-- `ARCHITECTURE.md` §555.
--
-- Deux tables :
--
--   · la LIAISON de l'entreprise à sa plateforme agréée, ses identifiants
--     d'API, le secret CHIFFRÉ (`chiffre-au-repos.ts`, domaine
--     « plateforme-facture ») : il ouvre le compte de facturation de
--     l'artisan, il ne s'écrit jamais en clair ;
--   · la TRANSMISSION de chaque facture déposée : le numéro du flux chez la
--     plateforme, son état, la raison d'un refus.
--
-- Expand seul : deux tables neuves, aucune ligne existante touchée.

CREATE TABLE IF NOT EXISTS "liaisons_plateformes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- Celles dont Atlas connaît l'adresse (`src/server/plateformes/catalogue.ts`).
  "plateforme" text NOT NULL CHECK ("plateforme" IN ('pennylane')),
  -- L'identifiant client de l'API commune (OAuth2, « client credentials »).
  -- Vide : le secret est un jeton d'accès qui se présente tel quel.
  "identifiant" text,
  "secret_chiffre" text NOT NULL CHECK (length(btrim("secret_chiffre")) > 0),
  -- `coupee` : la plateforme a refusé ces identifiants. Rien ne part plus vers
  -- elle tant qu'il ne les a pas remplacés (son choix 3 B).
  "etat" text NOT NULL DEFAULT 'reliee' CHECK ("etat" IN ('reliee', 'coupee')),
  "coupee_le" timestamptz,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- Une plateforme reliée par entreprise : relier à nouveau remplace.
  CONSTRAINT "liaisons_plateformes_une_par_entreprise" UNIQUE ("entreprise_id")
);

CREATE TABLE IF NOT EXISTS "transmissions_factures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "facture_id" uuid NOT NULL,
  "plateforme" text NOT NULL CHECK ("plateforme" IN ('pennylane')),
  -- L'identifiant que la plateforme a rendu au dépôt (`flowId`).
  "flux_id" text NOT NULL CHECK (length(btrim("flux_id")) > 0),
  -- `en_cours` : déposée, contrôle de la plateforme pas encore rendu ·
  -- `transmise` : la plateforme l'a acceptée · `refusee` : elle l'a refusée,
  -- `raison` dit pourquoi.
  "etat" text NOT NULL DEFAULT 'en_cours' CHECK ("etat" IN ('en_cours', 'transmise', 'refusee')),
  "raison" text,
  "deposee_le" timestamptz NOT NULL DEFAULT now(),
  "lue_le" timestamptz,
  -- **La facture de la MÊME entreprise**, par la clé double.
  CONSTRAINT "transmissions_factures_facture_fk" FOREIGN KEY ("facture_id", "entreprise_id")
    REFERENCES "factures"("id", "entreprise_id") ON DELETE CASCADE,
  -- Une facture ne se dépose qu'une fois.
  CONSTRAINT "transmissions_factures_une_par_facture" UNIQUE ("facture_id")
);
CREATE INDEX IF NOT EXISTS "transmissions_factures_recentes_idx" ON "transmissions_factures" ("entreprise_id", "deposee_le" DESC);

ALTER TABLE "liaisons_plateformes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liaisons_plateformes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "liaisons_plateformes_isolation" ON "liaisons_plateformes"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "liaisons_plateformes" TO atlas_app;

ALTER TABLE "transmissions_factures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transmissions_factures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "transmissions_factures_isolation" ON "transmissions_factures"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "transmissions_factures" TO atlas_app;
