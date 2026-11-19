-- LES HOMMES DE SA LIGNE DE MAIN D'ŒUVRE.
--
-- Sa capture du 18 novembre 2026 : sur un devis préparé « sur une ligne »
-- (2 hommes × 2 jours, 1 600 €), la feuille « Main d'œuvre » posait une
-- seconde ligne au lieu de changer la sienne. Sa réponse : *« changer ma
-- ligne »*, une seule ligne à 3 hommes × 2 jours. La feuille se rouvre donc
-- sur SA ligne, et 6 jour/homme ne disent pas s'il a mis 3 hommes 2 jours ou
-- 2 hommes 3 jours.
--
--   · `lignes_prix.hommes_main_doeuvre` : les hommes de son équipe sur sa
--     ligne de main d'œuvre, posés par la feuille ou la dictée. NULL sur
--     toute ligne d'avant, un partenaire, un travail : la feuille relit alors
--     les hommes de la dictée (`equipeDeSaLigne`).
--
-- **EXPAND SEUL** : une colonne NULL, aucune ligne lue ni réécrite. Les droits
-- de la table couvrent la colonne.

ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "hommes_main_doeuvre" integer;
