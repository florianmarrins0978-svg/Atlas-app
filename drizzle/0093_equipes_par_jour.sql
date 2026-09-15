-- Les équipes d'un chantier se cochent JOUR PAR JOUR, plus pour tout le chantier.
--
-- **Sa plainte du 15 septembre 2026, sur un chantier de huit jours :** *« si je
-- mets Antoine et Julien le premier jour ça les met automatiquement sur les
-- 8 jours, ça c'est bien ; mais si le 4ᵉ jour je décide de ne pas mettre
-- Julien, ça l'enlève partout, et ça faut pas ! Ce sera pas forcément les mêmes
-- équipes tous les jours. »*
--
-- `equipes_du_chantier` ne savait dire qu'« untel le matin » pour TOUT le
-- chantier (migration 0058). Le §293 et la « proposition C » du 8 septembre
-- avaient déjà dû contourner cette limite (« le modèle ne savait pas dire
-- Julien vendredi mais pas jeudi »). Ici, le modèle le dit : une ligne porte
-- son JOUR.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- **ÉTENDRE SEULEMENT — rien n'est converti, rien n'est retiré (expand).**
--
-- `jour` reste NULL sur les lignes d'avant, et **NULL garde son sens exact
-- d'avant : « vaut pour chaque jour où le chantier est posé »**. La règle qui
-- le lit vit à un seul endroit, `src/lib/equipes-par-jour.ts`
-- (`equipesDuJour`, `basculerCeJour`), et le code d'avant, qui écrit sans jour, reste juste
-- pendant la bascule (deployment-safety.md : jamais un seul déploiement).
--
-- Pourquoi aucune conversion ici : déplier une ligne sans jour demande de
-- savoir quels jours le chantier occupe — un bloc qui saute les week-ends, ou
-- ses créneaux morcelés (0085). Cette règle vit en TypeScript (`creneauxPoses`)
-- et la recopier en SQL serait une seconde règle (`CLAUDE.md` §3). Les lignes
-- sans jour se déplient donc **au premier geste** sur le chantier, par le code
-- qui possède la règle (`basculerEquipeDuChantier`), et une table sous FORCE
-- RLS n'est jamais réécrite à l'aveugle (migrations.md).
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE "equipes_du_chantier" ADD COLUMN "jour" date;

-- L'unicité porte désormais le jour. `NULLS NOT DISTINCT` (PostgreSQL 15+) :
-- deux lignes « sans jour » pour la même équipe sur la même demi-journée sont
-- bien le même doublon qu'avant — sans cette clause, NULL ≠ NULL et la
-- contrainte d'avant aurait disparu en silence.
ALTER TABLE "equipes_du_chantier" DROP CONSTRAINT "equipes_du_chantier_uk";
ALTER TABLE "equipes_du_chantier"
  ADD CONSTRAINT "equipes_du_chantier_uk"
  UNIQUE NULLS NOT DISTINCT ("chantier_id", "jour", "demi", "equipe_id");

-- Les droits d'`atlas_app` (0058) couvrent déjà SELECT, INSERT, UPDATE, DELETE
-- sur la table entière : une colonne de plus n'y change rien.
