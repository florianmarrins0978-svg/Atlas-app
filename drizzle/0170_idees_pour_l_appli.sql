-- UNE IDÉE POUR L'APPLI : chaque utilisateur dit ce qui lui manque, et
-- l'éditeur (le patron d'Atlas) le lit. Sa demande du 5 novembre 2026, sa
-- planche du même soir (`appli/soignee/une-idee-pour-l-appli.html`), ses choix
-- 1 A, 2 B, 3 B : l'artisan suit ses idées, l'éditeur les range.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- **DEUX LECTEURS, ET C'EST TOUT LE SUJET DE CE FICHIER.**
--
-- L'artisan lit les idées de SON entreprise, sous l'isolation ordinaire
-- (`app.entreprise_id`, posé par `withEntreprise`). L'éditeur lit celles de
-- TOUTES les entreprises : c'est la seule table de la base où un compte voit
-- des lignes d'autres entreprises que la sienne.
--
-- **Ce qui a été écarté, et pourquoi.**
--   lever la RLS pour l'éditeur (`NO FORCE`, `BYPASSRLS`) : interdit
--     (`CLAUDE.md` §4), et la table entière serait ouverte à tout chemin ;
--   une copie dans une table sans isolation : n'importe quelle requête mal
--     écrite y lirait les idées de tout le monde, et le texte peut nommer un
--     client ;
--   une seconde application : la même base, et une porte de plus sur internet.
--
-- **Ce qui est retenu : une politique de plus, sur CETTE table seulement.** Le
-- réglage `app.lecteur_des_idees` vaut « editeur » dans une transaction que le
-- serveur n'ouvre qu'après avoir relu l'adresse du compte en base et l'avoir
-- comparée à `ATLAS_EDITEUR_EMAIL` (`withEditeur`, `src/server/editeur.ts`).
-- Même confiance que `app.abonnement_prestataire` (0084), posé après la
-- signature de Stripe. Il ne donne rien d'autre : ni les chantiers, ni les
-- clients, ni le nom d'une entreprise. C'est pourquoi le nom de l'auteur et
-- celui de son entreprise sont FIGÉS sur la ligne au moment de l'envoi : les
-- relire à côté obligerait à ouvrir `users` et `entreprises` à l'éditeur.
--
-- **L'artisan n'écrit qu'une fois.** Il envoie (INSERT, état « envoyée », ni
-- réponse ni date de tri), puis ne touche plus à rien : aucune politique
-- UPDATE ni DELETE ne lui est ouverte. « Annuler » se joue AVANT l'envoi, dans
-- le tiroir de l'écran (`useRetraits`), jamais par un effacement.
--
-- **EXPAND SEUL** : deux tables neuves, aucune ligne existante touchée, rien à
-- éprouver sur une base habitée ni sous FORCE RLS.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "idees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- Le compte qui l'a dite. Un compte effacé ne fait pas disparaître l'idée :
  -- elle reste lisible, sous le nom figé ci-dessous.
  "auteur_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "auteur_nom" text NOT NULL CHECK (length("auteur_nom") BETWEEN 1 AND 120),
  "auteur_role" text NOT NULL CHECK ("auteur_role" IN ('proprietaire', 'facturation', 'commercial', 'salarie')),
  "entreprise_nom" text NOT NULL CHECK (length("entreprise_nom") BETWEEN 1 AND 200),
  "texte" text NOT NULL CHECK (length(btrim("texte")) BETWEEN 1 AND 2000),
  "etat" text NOT NULL DEFAULT 'envoyee' CHECK ("etat" IN ('envoyee', 'prevue', 'pas_prevue', 'faite')),
  "reponse" text CHECK ("reponse" IS NULL OR length("reponse") BETWEEN 1 AND 1000),
  "envoyee_le" timestamptz NOT NULL DEFAULT now(),
  -- Le dernier geste de l'éditeur sur cette idée : la ligne des Réglages dit
  -- « Votre idée est dans l'appli » quelques jours après qu'elle est faite.
  "traitee_le" timestamptz
);
CREATE INDEX IF NOT EXISTS "idees_de_l_auteur_idx" ON "idees" ("entreprise_id", "auteur_id", "envoyee_le" DESC);
CREATE INDEX IF NOT EXISTS "idees_par_etat_idx" ON "idees" ("etat", "envoyee_le" DESC);

ALTER TABLE "idees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idees" FORCE ROW LEVEL SECURITY;

-- L'artisan : ses idées à lui, et l'envoi, rien d'autre.
CREATE POLICY "idees_de_l_entreprise_lire" ON "idees" FOR SELECT
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
CREATE POLICY "idees_de_l_entreprise_envoyer" ON "idees" FOR INSERT
  WITH CHECK (
    "entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid
    AND "etat" = 'envoyee' AND "reponse" IS NULL AND "traitee_le" IS NULL
  );

-- L'éditeur : toutes les idées, et leur tri. Le réglage n'est posé que par
-- `withEditeur`, après vérification du compte.
CREATE POLICY "idees_editeur_lire" ON "idees" FOR SELECT
  USING (current_setting('app.lecteur_des_idees', true) = 'editeur');
CREATE POLICY "idees_editeur_ranger" ON "idees" FOR UPDATE
  USING (current_setting('app.lecteur_des_idees', true) = 'editeur')
  WITH CHECK (current_setting('app.lecteur_des_idees', true) = 'editeur');

-- Les privilèges par défaut (0081) donneraient tout : on ne rend que ce qui
-- sert. Le tri n'écrit que trois colonnes ; le texte, l'auteur et
-- l'entreprise ne se réécrivent jamais, et rien ne s'efface.
GRANT SELECT, INSERT ON "idees" TO atlas_app;
REVOKE UPDATE, DELETE ON "idees" FROM atlas_app;
GRANT UPDATE ("etat", "reponse", "traitee_le") ON "idees" TO atlas_app;

COMMENT ON TABLE "idees" IS 'Une idée pour l''appli : l''artisan la dit, l''éditeur la range (5 novembre 2026). Deux lecteurs : l''entreprise, et l''éditeur par app.lecteur_des_idees.';

-- ═══════════════════════════════════════════════════════════════════════════
-- LE JOUR OÙ L'ÉDITEUR A ÉTÉ PRÉVENU — un seul courriel par journée.
--
-- **Sans isolation, comme `termes_metier` (0025), et pour la même raison** :
-- il n'y a rien à isoler. Une date, et l'heure de l'envoi : ni idée, ni
-- entreprise, ni personne. La première idée du jour pose la ligne et part en
-- courriel ; les suivantes trouvent la ligne et se taisent.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "idees_alertes" (
  "jour" date PRIMARY KEY,
  "envoyee_le" timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON "idees_alertes" TO atlas_app;
REVOKE UPDATE, DELETE ON "idees_alertes" FROM atlas_app;

COMMENT ON TABLE "idees_alertes" IS 'Les jours où l''éditeur a été prévenu d''une idée par courriel : une date, rien d''autre (5 novembre 2026).';
