-- « J'AI VU » SUR LES RAPPELS DES CONTRÔLES DES VÉHICULES.
--
-- Sa demande du 3 novembre 2026, devant la carte du contrôle technique de
-- l'Amarok : « c'est bien le rappel, mais j'ai aucun moyen de l'enlever. Il faut
-- qu'il y ait une petite case J'ai vu, je peux cliquer pour l'enlever. » Rappelé
-- de ce qu'un contrôle oublié coûte au bord de la route, il a choisi : la carte
-- part tout de suite, et revient en rouge si l'échéance passe sans contrôle.
--
-- CE QUE LA COLONNE RETIENT : LA DATE LIMITE QUI A ÉTÉ VUE, pas l'instant du
-- geste. Le « vu » vaut pour cette échéance-là. Un nouveau procès-verbal ou une
-- date retapée, et la date du contrôle n'est plus celle qui a été vue : le
-- rappel repart à neuf sans qu'aucune écriture ait à effacer l'ancien « vu ».
-- Une échéance dépassée revient quoi que dise la colonne (`src/lib/vehicules.ts`,
-- `rappelsDesVehicules`).
--
-- POURQUOI PAS `rappels_vus` (migration 0071). Sa cible est un chantier,
-- `NOT NULL` et en clé étrangère, et son « vu » se réveille au bout d'un délai
-- réglé. Ici la cible est un véhicule et le réveil est une date du calendrier.
-- La plier à ce cas demandait de relâcher sa clé et de réécrire sa contrainte de
-- genre : une table habitée retouchée pour une idée qui n'est pas la sienne.
--
-- SUR LA LIGNE DU VÉHICULE, une colonne par contrôle, à côté de la date qu'elle
-- regarde : la ligne est déjà sous FORCE ROW LEVEL SECURITY (migration 0131),
-- donc le « vu » d'une entreprise est invisible d'une autre sans politique de
-- plus, et il part avec le véhicule dans la sauvegarde.
--
-- Expand seul : trois colonnes vides, aucune ligne existante réécrite (rien à
-- prouver sous FORCE RLS), aucune contrainte posée. Le code d'avant les ignore
-- et montre toutes les cartes, comme aujourd'hui.
ALTER TABLE "vehicules"
  ADD COLUMN IF NOT EXISTS "controle_technique_vu_pour" date,
  ADD COLUMN IF NOT EXISTS "pollution_vu_pour" date,
  ADD COLUMN IF NOT EXISTS "contre_visite_vu_pour" date;

COMMENT ON COLUMN "vehicules"."controle_technique_vu_pour" IS
  'La date limite du contrôle technique sur laquelle le patron a touché « J''ai vu ». Le rappel se tait tant que la date est la même et pas dépassée.';
COMMENT ON COLUMN "vehicules"."pollution_vu_pour" IS
  'La date limite du contrôle pollution sur laquelle le patron a touché « J''ai vu ».';
COMMENT ON COLUMN "vehicules"."contre_visite_vu_pour" IS
  'La date limite de la contre-visite sur laquelle le patron a touché « J''ai vu ».';
