-- ═══════════════════════════════════════════════════════════════════════════
-- UNE ABSENCE PEUT NE PRENDRE QU'UNE DEMI-JOURNÉE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Sa question du 8 septembre 2026 :** *« lorsque je note les congés ou les
-- jours où les salariés ne sont pas là, je peux les mettre seulement le matin
-- ou seulement l'après-midi ? Sinon il faut corriger ça. »*
--
-- La réponse était non. `creneauxOccupesParAbsence` bouclait sur les deux
-- moments de chaque jour, et la table ne portait que des dates : un
-- rendez-vous médical d'une heure lui coûtait la journée entière de son gars —
-- une demi-journée de capacité retirée pour rien, sur un planning qu'il remplit
-- au plus juste.
--
-- **Sa décision sur maquette (`appli/qui-travaille-quel-jour.html`) : D2.**
--
-- ─────────────────────────────────────────────────────────────────────────
-- **DEUX BORNES, ET PAS DEUX BOOLÉENS.**
--
-- L'autre forme possible était `matin bool` + `apres_midi bool`. Elle tombe dès
-- qu'une absence dure plusieurs jours : « du jeudi après-midi au lundi matin »
-- n'a pas de sens en booléens — il faudrait les appliquer à CHAQUE jour, ce qui
-- exclurait tous les matins de la période au lieu du seul premier.
--
-- Deux bornes disent exactement ce qu'on veut, et rien de plus :
--
--   | Ce qu'il note              | premier_demi | dernier_demi |
--   |----------------------------|--------------|--------------|
--   | jeudi, la journée          | matin        | apres_midi   |
--   | jeudi matin seulement      | matin        | matin        |
--   | jeudi après-midi seulement | apres_midi   | apres_midi   |
--   | du jeudi midi au lundi midi| apres_midi   | matin        |
--
-- **LES LIGNES EXISTANTES SONT DES JOURNÉES ENTIÈRES**, et les valeurs par
-- défaut le disent : ('matin', 'apres_midi'). Aucune absence déjà notée ne
-- change de sens, et aucune date déjà bloquée ne se rouvre — ce serait le
-- défaut le plus coûteux de cette migration, puisqu'il ne se verrait qu'au
-- moment où un client retient une date impossible.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE "absences_equipe"
  ADD COLUMN "premier_demi" text NOT NULL DEFAULT 'matin',
  ADD COLUMN "dernier_demi" text NOT NULL DEFAULT 'apres_midi';

ALTER TABLE "absences_equipe"
  ADD CONSTRAINT "absences_equipe_premier_demi_ck"
    CHECK ("premier_demi" IN ('matin', 'apres_midi')),
  ADD CONSTRAINT "absences_equipe_dernier_demi_ck"
    CHECK ("dernier_demi" IN ('matin', 'apres_midi'));

-- **Une absence VIDE ne doit pas pouvoir exister**, et c'est la même raison que
-- la contrainte d'ordre posée en 0044 : sur un seul jour, « de l'après-midi au
-- matin » n'occupe aucun créneau. Elle retirerait zéro capacité tout en
-- s'affichant comme une absence — un jour que le patron croit bloqué et qui
-- part chez un client.
ALTER TABLE "absences_equipe"
  ADD CONSTRAINT "absences_equipe_demi_ordre_ck"
    CHECK (
      "dernier_jour" > "premier_jour"
      OR NOT ("premier_demi" = 'apres_midi' AND "dernier_demi" = 'matin')
    );
