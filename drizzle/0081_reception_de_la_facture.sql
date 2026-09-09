-- « Ah ouais mais j'ai pas vu votre facture » — la réception se trace.
--
-- Sa demande du 9 septembre 2026 : « sur le lien qu'on envoie au client avec sa
-- facture, on peut pas mettre une case à cocher qui stipule qu'il accuse bonne
-- réception ? ça évite les "ah ouais mais j'ai pas vu votre facture" ».
--
-- Il a écarté lui-même la version dure — conditionner le téléchargement à la
-- case : « ça ne l'empêche pas de télécharger la facture s'il ne coche pas ! ».
-- Une facture se donne ; la retenir se retourne contre l'artisan, puisqu'un
-- client qui ne coche pas ne télécharge pas non plus, et là il ne l'a vraiment
-- pas reçue.
--
-- ────────────────────────────────────────────────────────────────────────────
-- DEUX DATES, ET LA PREMIÈRE EST LA PLUS SOLIDE.
--
--   · `ouverte_at` — Atlas la note tout seul. Elle ne dépend pas de la bonne
--     volonté du client, et c'est celle qu'on oppose à « je ne l'ai jamais
--     reçue ». Écrite UNE SEULE FOIS, à la première ouverture ;
--   · `accuse_at` — la case. Un geste volontaire, donc plus parlant, mais qui
--     peut ne jamais venir. Elle s'ajoute, elle ne remplace pas.
--
-- Sa question suivante commandait tout le reste : « Atlas note l'ouverture
-- seul, mais en cas de litige, où est-ce que l'utilisateur va rechercher cette
-- info ? » — nulle part, jusqu'ici. D'où `vu_par_patron_at`, qui n'efface que
-- la CARTE de l'accueil : les deux dates, elles, restent sur la facture. Une
-- preuve qu'on ne sait pas retrouver ne prouve rien.
--
-- ────────────────────────────────────────────────────────────────────────────
-- POURQUOI CES COLONNES SONT SUR L'ENVOI, ET NON SUR LA FACTURE.
--
-- Une facture peut partir deux fois — le premier lien expire, le client
-- redemande. Ce qui est ouvert, c'est un LIEN, pas une pièce comptable, et
-- c'est le lien qui porte le jeton par lequel la trace s'écrit. Poser les dates
-- sur `factures` obligerait à décider laquelle des deux ouvertures compte, au
-- moment précis où l'on cherche une preuve.
--
-- Même trio que la réponse au devis (`envois_devis`, migration 0015) :
-- l'horodatage, l'adresse et l'appareil. Ce n'est pas de la surveillance, c'est
-- ce qui distingue une trace d'une affirmation — et la page de confidentialité
-- l'annonce déjà pour le devis : « cette trace vaut signature ».

ALTER TABLE "envois_factures"
  ADD COLUMN "ouverte_at" timestamptz,
  ADD COLUMN "accuse_at" timestamptz,
  ADD COLUMN "adresse_ip" text,
  ADD COLUMN "agent_utilisateur" text,
  ADD COLUMN "vu_par_patron_at" timestamptz;

-- Une réception ne peut pas précéder l'envoi. Sans cette borne, une horloge
-- fausse ou un appel forgé poserait une date qui décrédibiliserait la trace
-- entière au moment où elle sert.
ALTER TABLE "envois_factures"
  ADD CONSTRAINT "envois_factures_ouverture_apres_envoi"
    CHECK ("ouverte_at" IS NULL OR "ouverte_at" >= "envoye_at"),
  ADD CONSTRAINT "envois_factures_accuse_apres_envoi"
    CHECK ("accuse_at" IS NULL OR "accuse_at" >= "envoye_at");

-- Ce que l'accueil interroge à chaque affichage : les réceptions confirmées que
-- le patron n'a pas encore acquittées. Partiel, parce que la quasi-totalité des
-- lignes ne sont pas concernées.
CREATE INDEX "envois_factures_a_signaler_idx"
  ON "envois_factures" ("entreprise_id", "accuse_at")
  WHERE "accuse_at" IS NOT NULL AND "vu_par_patron_at" IS NULL;

-- Le client écrit SANS session, donc sans entreprise_id connu : la politique
-- d'isolation ne peut pas s'y appliquer. Écriture strictement limitée à un
-- jeton exact, posé par le code juste avant la requête — la même serrure que la
-- lecture voisine, et exactement ce que fait déjà `envois_devis_reponse_par_jeton`.
--
-- Ce n'est pas un affaiblissement de la RLS (`CLAUDE.md` §4) : sans le jeton,
-- aucune ligne n'est visible ni modifiable, et aucune énumération n'est
-- possible. Les politiques PERMISSIVE se combinent en OR : celle-ci s'ajoute à
-- l'isolation, elle ne la remplace pas.
CREATE POLICY "envois_factures_reception_par_jeton" ON "envois_factures"
  FOR UPDATE
  USING ("jeton" = NULLIF(current_setting('app.jeton_envoi', true), ''))
  WITH CHECK ("jeton" = NULLIF(current_setting('app.jeton_envoi', true), ''));

-- Aucun GRANT ici, et ce n'est pas un oubli : `ALTER DEFAULT PRIVILEGES FOR
-- ROLE atlas_owner` (scripts/bootstrap-postgres-ci.sql) donne déjà SELECT,
-- INSERT, UPDATE et DELETE à `atlas_app` sur toute table créée ensuite. Le
-- `GRANT SELECT, INSERT` de la migration 0024 était donc redondant — et il
-- laisse croire, en le relisant, que l'UPDATE manquait. Vérifié sur la base :
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE grantee='atlas_app' AND table_name='envois_factures';
-- rend bien DELETE, INSERT, SELECT, UPDATE.
