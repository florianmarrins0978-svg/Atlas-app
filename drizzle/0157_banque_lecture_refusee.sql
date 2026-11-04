-- MA BANQUE — le refus de la dernière lecture, gardé.
--
-- Trouvé le 1er novembre 2026 en éprouvant Ma banque soignée (sa demande
-- « code ça », `appli/soignee/reglages-banque.html`). `lu_le` est posé AVANT
-- l'appel à la banque, pour que les relectures de l'accueil ne brûlent pas les
-- lectures permises. Après un refus, une page rouverte dans la demi-heure ne
-- relit pas, et rien en base ne disait que la tentative avait échoué : l'écran
-- affichait « Lue » à l'heure d'une lecture ratée.
--
-- Une colonne sur la liaison, nullable : `lecture_refusee`, la phrase du refus
-- de la dernière tentative, NULL quand elle a réussi (ou avant toute lecture).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne
-- ajoutée, aucune ligne réécrite. L'ancien code l'ignore ; le nouveau tolère
-- NULL pour toute liaison existante, ce qui se lit « pas de refus connu ».
-- Pas de `UPDATE`, pas de contrainte : rien à vérifier sur la base habitée.

ALTER TABLE "liaisons_bancaires" ADD COLUMN "lecture_refusee" text;
