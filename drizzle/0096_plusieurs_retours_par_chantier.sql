-- PLUSIEURS RETOURS D'INTERVENTION PAR CHANTIER — sa règle du 19 septembre
-- 2026, sur la sixième planche de la fiche d'intervention
-- (appli/fiche-intervention-sixieme.html), codée sur son « tu peux coder
-- exactement cette planche » :
--
--   « Il faut qu'on puisse l'envoyer même si on ne met pas de photo ou si
--   tout n'est pas coché, parce qu'un chantier de 8 jours, il faut pouvoir
--   faire plusieurs retours d'intervention jour après jour. »
--
-- ════════════════════════════════════════════════════════════════════════════
-- CE QUE ÇA DÉFAIT, ET POURQUOI C'ÉTAIT JUSTE AVANT. La migration 0080 posait
-- UN retour par chantier (`retours_intervention_chantier_uk`) : un second
-- « c'est fini » mettait le premier à jour, pour que le patron n'ait pas deux
-- retours à lire pour un seul travail. C'était pensé pour un chantier d'un
-- jour, rendu le soir. Sur un chantier de huit jours, c'est l'inverse qui
-- compte : le retour du soir 3 ne doit pas effacer celui du soir 2.
--
-- L'index unique tombe ; un index ordinaire prend sa place pour lire le
-- DERNIER retour d'un chantier (celui qui pré-coche la fiche le lendemain).
--
-- ════════════════════════════════════════════════════════════════════════════
-- CE QU'ELLE NE FAIT PAS. Elle ne touche aucune ligne : les retours existants
-- restent tels quels, un par chantier — ils sont simplement les premiers d'une
-- série possible. Aucune écriture sous FORCE RLS, donc rien à prouver
-- (`.claude/rules/migrations.md`).
--
-- ════════════════════════════════════════════════════════════════════════════
-- LA FENÊTRE, ET ELLE SE DIT. Le code d'AVANT écrit le retour avec
-- `ON CONFLICT (chantier_id)`, qui exige cet index unique : entre l'instant où
-- cette migration passe et celui où la version neuve est servie — le temps de
-- la construction, sur son espace —, un « C'est fini » de l'ancien écran
-- échoue. Rien d'autre ne casse. Le code neuf, lui, marche avec ou sans
-- l'index (`.claude/rules/deployment-safety.md`).

DROP INDEX IF EXISTS "retours_intervention_chantier_uk";

CREATE INDEX IF NOT EXISTS "retours_intervention_par_chantier_idx"
  ON "retours_intervention" ("chantier_id", "pose_le" DESC);
