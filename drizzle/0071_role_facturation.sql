-- LE RÔLE « FACTURATION », ET RIEN D'AUTRE DANS CETTE MIGRATION.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **D'où il vient.** Décision du patron, 30 août 2026, en figeant le modèle des
-- utilisateurs avant le premier artisan réel : *« une entreprise doit pouvoir
-- avoir plusieurs utilisateurs au service facturation, chacun avec son compte,
-- sa session et son rôle »*. Ce n'est pas un compte partagé « Facturation » : la
-- table porte déjà une clé unique sur (entreprise, personne) — jamais sur
-- (entreprise, rôle) —, donc plusieurs personnes portent le même rôle sans que
-- rien n'ait à changer ici.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **ADDITIVE, ET STRICTEMENT.** Aucune ligne n'est réécrite, aucun défaut n'est
-- touché, aucun rôle existant ne change de sens. Une migration de rôles qui
-- toucherait aux données porterait le risque qu'on ne veut à aucun prix ici :
-- une élévation de privilège pendant la migration elle-même. Le seul geste est
-- d'élargir la liste des valeurs acceptées.
--
-- **Une contrainte CHECK ne se modifie pas en place** : PostgreSQL n'a pas
-- d'ALTER CONSTRAINT pour un CHECK. On la retire et on la repose, dans la même
-- transaction que le reste (le runner joue chaque fichier d'un bloc) — la table
-- n'est donc jamais visible sans contrainte depuis une autre session.
--
-- **`IF EXISTS` sur le retrait, pour une raison précise** : une base montée
-- avant la migration 0065 n'a jamais porté cette contrainte. Sans lui, la
-- migration tomberait sur une base ancienne au lieu de la rattraper.

ALTER TABLE "membres_entreprise"
  DROP CONSTRAINT IF EXISTS "membres_entreprise_role_connu";

ALTER TABLE "membres_entreprise"
  ADD CONSTRAINT "membres_entreprise_role_connu"
  CHECK ("role" IN ('proprietaire', 'facturation', 'commercial', 'salarie'));

-- **NI RLS NI PRIVILÈGE NE BOUGENT, et c'est délibéré.** L'isolation d'Atlas ne
-- lit jamais le rôle : elle tient au couple (personne, entreprise) posé par
-- `withEntreprise`, et un patron de l'entreprise A n'atteint pas plus les
-- utilisateurs de B qu'auparavant. Le rôle décide de ce qu'on a le droit de
-- faire DANS son entreprise ; la RLS décide de quelle entreprise on parle. Les
-- mêler ferait dépendre la dernière barrière d'une valeur applicative.

COMMENT ON COLUMN "membres_entreprise"."role" IS
  'Le rôle de cette personne DANS cette entreprise : proprietaire, facturation, commercial ou salarie. Ce qu''il ouvre est décidé une seule fois, dans src/lib/acces-roles.ts.';
