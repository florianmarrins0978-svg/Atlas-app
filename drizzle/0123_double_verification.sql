-- LA DOUBLE VÉRIFICATION — sa décision du 30 septembre 2026
-- (`appli/double-verification.html`, la A et « oui »).
--
-- Jusque-là, un mot de passe volé suffisait pour entrer. Désormais, quand la
-- double vérification est active, le mot de passe (ou Google, ou Apple) doit
-- être suivi du code de l'appli d'authentification, d'un code de secours, ou
-- venir d'un appareil retenu. Face ID entre toujours sans code.
--
-- Expand seul : quatre tables neuves, aucune colonne touchée, aucune ligne
-- réécrite. L'ancien code les ignore et laisse entrer comme avant ; aucun
-- compte n'a de ligne ici tant qu'il n'a pas activé lui-même. Rien à prouver
-- sous FORCE RLS : aucun `UPDATE` ni `DELETE` de données existantes.
--
-- Données liées à une PERSONNE, avant toute entreprise : le contexte est
-- `app.utilisateur_id`, comme `codes_verification_email` (migration 0091).

-- Le secret partagé avec l'appli d'authentification. **Chiffré au repos**
-- (`src/server/secret-au-repos.ts`) : une base lue par-dessus l'épaule ne
-- donne pas de quoi fabriquer les codes. `active_le` vide = activation
-- commencée, code pas encore confirmé : la porte n'est PAS fermée tant que
-- l'artisan n'a pas prouvé que son appli donne le bon code. `dernier_pas` est
-- la tranche de trente secondes du dernier code accepté : un code ne sert
-- qu'une fois.
CREATE TABLE IF NOT EXISTS "double_verification" (
  "utilisateur_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "secret_chiffre" text NOT NULL,
  "active_le" timestamptz,
  "dernier_pas" bigint,
  "cree_le" timestamptz NOT NULL DEFAULT now()
);

-- Dix codes, chacun valable une fois. Jamais en clair : un HMAC du code avec
-- le secret de session, comme `codes_verification_email`.
CREATE TABLE IF NOT EXISTS "codes_secours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "empreinte" text NOT NULL,
  "utilise_le" timestamptz,
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("utilisateur_id", "empreinte")
);

-- « Ne plus demander sur cet appareil », trente jours. Le navigateur garde un
-- jeton ; la base n'en garde que l'empreinte. « Me déconnecter partout » les
-- efface tous.
CREATE TABLE IF NOT EXISTS "appareils_retenus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "empreinte" text NOT NULL UNIQUE,
  "expire_le" timestamptz NOT NULL,
  "cree_le" timestamptz NOT NULL DEFAULT now()
);

-- Le mot de passe est juste, le code n'est pas encore tapé : cinq minutes et
-- cinq essais, puis il faut retaper le mot de passe. Une ligne par tentative
-- en cours, effacée dès qu'elle aboutit.
CREATE TABLE IF NOT EXISTS "connexions_en_attente" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "empreinte" text NOT NULL UNIQUE,
  "expire_le" timestamptz NOT NULL,
  "essais" integer NOT NULL DEFAULT 0,
  "cree_le" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "double_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "double_verification" FORCE ROW LEVEL SECURITY;
ALTER TABLE "codes_secours" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "codes_secours" FORCE ROW LEVEL SECURITY;
ALTER TABLE "appareils_retenus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appareils_retenus" FORCE ROW LEVEL SECURITY;
ALTER TABLE "connexions_en_attente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "connexions_en_attente" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "double_verification_isolation" ON "double_verification";
CREATE POLICY "double_verification_isolation" ON "double_verification"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

DROP POLICY IF EXISTS "codes_secours_isolation" ON "codes_secours";
CREATE POLICY "codes_secours_isolation" ON "codes_secours"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

DROP POLICY IF EXISTS "appareils_retenus_isolation" ON "appareils_retenus";
CREATE POLICY "appareils_retenus_isolation" ON "appareils_retenus"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

DROP POLICY IF EXISTS "connexions_en_attente_isolation" ON "connexions_en_attente";
CREATE POLICY "connexions_en_attente_isolation" ON "connexions_en_attente"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "double_verification" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "codes_secours" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "appareils_retenus" TO atlas_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "connexions_en_attente" TO atlas_app;
