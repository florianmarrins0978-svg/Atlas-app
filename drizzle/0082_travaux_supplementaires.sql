-- ═══════════════════════════════════════════════════════════════════════════
-- LES TRAVAUX SUPPLÉMENTAIRES — sa demande du 31 août 2026, tranchée le 9
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Son constat : *« si on effectue des travaux en plus chez un client, on n'a
-- aucun moyen de rajouter les TS sur la facture »*. Il avait raison : la
-- facture recopie le devis et ne se modifie plus.
--
-- **Sa décision du 9 septembre 2026 : UNE SEULE FACTURE**, qui additionne le
-- devis accepté et le supplément, en deux blocs. Pas de seconde pièce, pas de
-- second règlement à relancer — *« deux factures, c'est deux fois le travail de
-- recouvrement pour un artisan seul »*.
--
-- ─── POURQUOI UNE COLONNE, ET PAS UNE TABLE ────────────────────────────────
--
-- Une table d'avenants aurait doublé tout ce qui existe : les totaux, la TVA
-- par taux, le PDF, le relevé. `lignes_facture` porte DÉJÀ son propre
-- `taux_tva` (migration 0073) : une ligne de supplément est une ligne de
-- facture comme une autre, avec son taux et son montant. Ce qui manquait,
-- c'est de savoir D'OÙ elle vient.
--
-- **Et cette provenance n'est pas cosmétique.** `reprendreLeDevisSurLaFacture`
-- efface toutes les lignes pour recopier le dernier devis envoyé : sans cette
-- colonne, reprendre le devis effacerait en silence les travaux supplémentaires
-- déjà saisis. C'est le défaut que cette migration existe pour rendre
-- impossible.
--
-- ─── CE QUI RESTE VRAI, ET QU'ON NE TOUCHE PAS ─────────────────────────────
--
-- Le devis parti ne se réécrit pas — `trg_devis_immuable` le refuse, et c'est
-- ce qui garantit que le document accepté par le client reste ce qu'il a
-- accepté. Sa règle du 9 septembre : *« oui, le devis ne se réécrit pas,
-- seulement la case travaux supplémentaires ; le reste, impossible de les
-- modifier »*. Rien ici ne l'affaiblit : on ajoute à la FACTURE, jamais au
-- devis.
--
-- Une facture ÉMISE reste immuable elle aussi : les suppléments ne s'ajoutent
-- qu'au brouillon, et le code le refuse (`factures.ts`).

ALTER TABLE "lignes_facture"
  ADD COLUMN IF NOT EXISTS "supplement" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "lignes_facture"."supplement" IS
  'true : travail ajouté sur la facture, hors devis accepté (9 septembre 2026). '
  'false : ligne recopiée du devis, effacée et refaite à chaque reprise.';

-- Les deux blocs se lisent dans cet ordre à l'écran comme au PDF : le devis
-- accepté d'abord, le supplément ensuite. L'index sert la lecture d'une
-- facture, qui les demande toujours ensemble et dans cet ordre.
CREATE INDEX IF NOT EXISTS "lignes_facture_bloc_idx"
  ON "lignes_facture" ("facture_id", "supplement", "ordre");
