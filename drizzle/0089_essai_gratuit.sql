-- L'ESSAI GRATUIT DE QUINZE JOURS — sa décision du 10 septembre 2026 :
-- « essai gratuit 15 jours », puis, au bout : « la B, mais il ne doit plus rien
-- pouvoir faire à part enregistrer ses documents, ses clients ».
--
-- La migration 0084 refusait « essai » DÉLIBÉRÉMENT, tant que la durée n'était
-- pas arrêtée : une durée qui figure dans un contrat ne se décide pas dans le
-- code. Il l'a donnée ; l'état entre.
--
-- ════════════════════════════════════════════════════════════════════════════
-- CE QUE PORTE UNE LIGNE D'ESSAI, ET POURQUOI RIEN D'AUTRE NE CHANGE.
--
--   statut        = 'essai'
--   formule       = 'illimite'  — on essaie TOUT, on choisit après
--                                 (`FORMULE_DE_LESSAI`, src/lib/abonnements.ts)
--   periode_fin   = la fin de l'essai, posée à la création du compte
--   *_prestataire = NULL         — Stripe ne connaît pas l'essai : il réclame une
--                                 carte d'avance, et l'article 14.2 des conditions
--                                 promet « sans saisie de moyen de paiement »
--
-- La durée (15) ne vit PAS ici : elle est dans `JOURS_ESSAI`, et c'est la
-- création du compte qui calcule `periode_fin`. Un chiffre en base se retouche
-- un soir de fatigue, et plus rien ne dit alors ce que l'écran compte.
--
-- ════════════════════════════════════════════════════════════════════════════
-- ET SON ATLAS À LUI NE BOUGE PAS. Aucune ligne n'est créée pour les entreprises
-- existantes : l'essai ne vaut que pour les comptes créés ensuite
-- (`creation-compte.ts`). Une entreprise sans ligne d'abonnement n'est ni en
-- essai, ni plafonnée, ni fermée — c'est la règle de `src/lib/abonnements.ts`.

ALTER TABLE "abonnements" DROP CONSTRAINT "abonnements_statut_connu";
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_statut_connu"
  CHECK ("statut" IN ('essai', 'actif', 'impaye', 'resilie'));
