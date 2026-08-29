-- Migration 0067 : aligner `corrections_dictee` sur la forme robuste des
-- politiques d'isolation — constat F5.
--
-- ── CE QUE C'EST, ET CE QUE CE N'EST PAS ─────────────────────────────────────
--
-- **Ce n'est PAS une fuite.** Personne n'a jamais pu lire les corrections d'une
-- autre entreprise par ce défaut, et il est important de le dire : une alerte
-- qui exagère s'apprend à être ignorée. Sans contexte posé,
-- `current_setting('app.entreprise_id', true)` rend NULL, `NULL::uuid` rend
-- NULL, la politique est fausse, et la table est vide. Le refus est intact.
--
-- **Ce qui casse, c'est le cas du contexte VIDE.** PostgreSQL remet un réglage
-- de session à la chaîne vide — et non à NULL — après certaines transactions
-- sur une connexion mutualisée. `''::uuid` ne rend alors pas « rien » : il
-- LÈVE, `invalid input syntax for type uuid: ""`. Mesuré sous `atlas_app` le
-- 25 août 2026 sur cette table, et comparé à `clients` au même instant, qui
-- rend 0.
--
-- L'écran de dictée tombe donc en erreur au lieu de se montrer vide, et le
-- message accuse un type de données là où le vrai coupable est un contexte
-- perdu : il envoie chercher au mauvais endroit. C'est exactement ce que la
-- migration 0002 avait corrigé, en janvier, pour les douze tables d'alors.
-- 0025 a créé cette table quatre mois plus tard sans reprendre la leçon.
--
-- ── POURQUOI UNE MIGRATION NEUVE, ET NON UNE CORRECTION DE 0025 ──────────────
--
-- Une migration déjà appliquée ne se réécrit pas : les bases où elle est passée
-- ne la rejoueront jamais — `_migrations` porte son nom —, et la corriger sur
-- le disque ne changerait que les bases neuves. Le défaut survivrait donc
-- précisément là où il existe. La règle vaut aussi pour le RENOMMAGE, pour la
-- même raison.
--
-- ── CETTE MIGRATION NE PEUT RIEN CASSER ──────────────────────────────────────
--
-- Elle ne touche ni aux données, ni aux colonnes, ni aux droits. Les deux
-- formes se comportent à l'identique dans TOUS les cas où l'ancienne
-- fonctionnait ; elles ne diffèrent que là où l'ancienne levait.

DROP POLICY IF EXISTS "corrections_dictee_isolation" ON "corrections_dictee";

CREATE POLICY "corrections_dictee_isolation" ON "corrections_dictee"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
