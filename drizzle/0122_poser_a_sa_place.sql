-- POSER À SA PLACE — son choix B du 7 octobre 2026
-- (`appli/poser-a-sa-place.html`).
--
-- Un client âgé reçoit le lien du devis et n'arrive pas à choisir ses dates.
-- Le patron le pose lui-même au planning, puis :
--
-- 1. « Signe sur son lien » : le lien n'offre plus de dates, il montre celles
--    que le patron a posées et ne demande plus que l'accord. Sans ce drapeau,
--    le client pourrait encore en choisir d'autres, et sa réponse déplacerait
--    le chantier que le patron vient de poser.
-- 2. « Signé sur papier » : le patron enregistre l'accord que le client a
--    signé sur un devis papier. Le lien se ferme ; l'acceptation porte la
--    trace qu'elle vient du papier, et de qui l'a saisie, pour ne jamais se
--    confondre avec une signature en ligne (date, heure, appareil).
--
-- Expand seul : deux colonnes à valeur par défaut fausse, une nullable,
-- aucune ligne réécrite, aucune contrainte. L'ancien code les ignore et se
-- comporte comme avant ; le code neuf servi sans elles tomberait, d'où leur
-- arrivée avant lui (`.claude/rules/deployment-safety.md`).
--
-- Aucun `UPDATE` ici, donc rien à prouver sous FORCE RLS : `envois_devis` en
-- porte (migration 0015) et `atlas_owner` n'a pas BYPASSRLS.
ALTER TABLE "envois_devis" ADD COLUMN IF NOT EXISTS "dates_fixees_par_artisan" boolean NOT NULL DEFAULT false;
ALTER TABLE "envois_devis" ADD COLUMN IF NOT EXISTS "accord_sur_papier" boolean NOT NULL DEFAULT false;
-- Qui a saisi l'accord papier. Sans clé étrangère : c'est une trace, et elle
-- doit survivre au départ de ce compte.
ALTER TABLE "envois_devis" ADD COLUMN IF NOT EXISTS "accord_papier_par" uuid;
