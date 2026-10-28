-- MA BANQUE — la profondeur d'historique que la banque a réellement rendue.
--
-- Sa règle du 28 octobre 2026 : lire le maximum, et si la banque refuse une
-- période, **le dire à l'écran avec la raison**, sans jamais montrer moins en
-- silence.
--
-- Deux colonnes sur la liaison, nullables : `historique_jours` (combien de
-- jours ont été lus, NULL tant qu'aucune lecture n'a réussi) et
-- `historique_refus` (le refus de la banque pour la période plus profonde,
-- NULL quand elle a accepté la demande maximale).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : deux colonnes
-- ajoutées, aucune ligne réécrite. L'ancien code ignore les colonnes neuves ;
-- le nouveau tolère qu'elles soient NULL pour toute liaison déjà existante.
-- Pas de `UPDATE`, pas de contrainte : rien à vérifier sur la base habitée.

ALTER TABLE "liaisons_bancaires" ADD COLUMN "historique_jours" integer;
ALTER TABLE "liaisons_bancaires" ADD COLUMN "historique_refus" text;
