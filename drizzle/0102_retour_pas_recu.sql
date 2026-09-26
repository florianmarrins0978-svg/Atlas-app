-- « RETOUR PAS REÇU » PEUT SE RANGER D'UN « J'AI VU ».
--
-- Sa planche du 26 septembre 2026 (`appli/rappel-du-retour.html`) : quand il a
-- allumé « Demander une preuve », une carte « Retour pas reçu » paraît sur son
-- accueil le lendemain d'un jour travaillé sans retour, et « J'ai vu » la
-- retire comme les autres rappels.
--
-- Le genre est contraint EN BASE depuis 0071 : une valeur inventée ferait taire
-- un rappel que personne ne saurait rallumer. On ÉTEND la liste, rien d'autre.
--
-- **Aucune ligne ne peut la violer** : l'ancienne liste est contenue dans la
-- nouvelle, donc la vérification de la contrainte, qui voit toutes les lignes
-- RLS ou pas, ne peut pas échouer. Et aucune ligne n'est écrite : la FORCE RLS
-- de la table n'a rien à cacher à cette migration.
ALTER TABLE "rappels_vus" DROP CONSTRAINT "rappels_vus_genre_check";
ALTER TABLE "rappels_vus" ADD CONSTRAINT "rappels_vus_genre_check" CHECK ("genre" IN (
  'chantier-sans-devis', 'devis-sans-reponse', 'chantier-non-facture', 'retour-pas-recu'
));
