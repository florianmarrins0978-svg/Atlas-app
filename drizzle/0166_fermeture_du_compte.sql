-- FERMER SON COMPTE (ses décisions du 5 novembre 2026, docs/QUESTIONS.md
-- question 33, planche `appli/soignee/fermer-mon-compte.html`, choix A).
--
-- Trois dates sur l'entreprise, et rien d'autre :
--
--   · `fermeture_demandee_le` : le jour où le patron a appuyé ;
--   · `fermeture_le` : le jour où le compte passe en lecture seule. C'est la
--     fin de ce qui est payé (son choix A : fermer en cours de mois ne lui
--     retire pas ce qu'il a payé), ou le jour même sans abonnement payant ;
--   · `reste_efface_le` : le jour où la purge a effacé ce qui ne se garde pas
--     (trente jours après `fermeture_le`). Posé par la purge planifiée, et
--     c'est ce qui l'empêche de repasser.
--
-- **Les trois vivent ensemble ou pas du tout** pour les deux premières : une
-- fermeture sans date d'effet ne se lirait pas.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : trois colonnes
-- nullables, aucune ligne existante relue ni écrite. Rien à éprouver sur une
-- base habitée, et `entreprises` n'est pas sous RLS. Un code d'avant servi sur
-- ce schéma les ignore : aucun compte n'est fermé tant que le code qui ferme
-- n'est pas servi.
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "fermeture_demandee_le" timestamptz;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "fermeture_le" timestamptz;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "reste_efface_le" timestamptz;

ALTER TABLE "entreprises" DROP CONSTRAINT IF EXISTS "entreprises_fermeture_complete_ck";
ALTER TABLE "entreprises" ADD CONSTRAINT "entreprises_fermeture_complete_ck"
  CHECK ((fermeture_demandee_le IS NULL) = (fermeture_le IS NULL));
