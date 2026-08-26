-- Les cinq conditions réglées atteignent enfin le devis.
--
-- SON CONSTAT DU 25 AOÛT 2026 : « les autres qui sont en ON doivent-ils être
-- visibles sur le devis ? car je ne vois rien, est-ce normal ? » — non. Depuis
-- la migration 0040, six réglages se saisissent dans Réglages → Documents et
-- UN SEUL atteignait le document : la validité. L'acompte, le délai, les moyens
-- de paiement, le rappel des pénalités et le texte de pied s'enregistraient,
-- s'affichaient dans l'aperçu de cet écran… et le client n'en voyait rien.
-- `lignesConditionsDevis` composait bien ces phrases : personne ne l'appelait
-- hors de l'aperçu.
--
-- POURQUOI ON LES FIGE SUR LE DEVIS, et non on les relit à l'impression.
-- C'est la règle des pièces émises (`ARCHITECTURE.md` §94), déjà appliquée à la
-- validité par la 0040 : un devis garde ce qu'il portait le jour où il a été
-- créé. Les relire au moment de composer le PDF ferait changer les conditions
-- d'un devis DÉJÀ ENVOYÉ parce que l'artisan a corrigé ses réglages entre-temps
-- — pendant que son client a une autre feuille sous les yeux, et que c'est
-- celle-là qui l'engage.
--
-- AUCUN RATTRAPAGE, ET C'EST DÉLIBÉRÉ. Contrairement à la validité — dont
-- 30 jours était ce que la constante imprimait déjà —, ces cinq lignes ne
-- figuraient sur AUCUN devis existant. Les poser rétroactivement ajouterait des
-- conditions à des documents partis sans elles. NULL partout veut donc dire
-- « rien ne s'imprime », et les anciens devis sortent identiques à eux-mêmes.
ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS acompte_pourcent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS delai_paiement_jours integer,
  ADD COLUMN IF NOT EXISTS moyens_paiement text,
  ADD COLUMN IF NOT EXISTS rappeler_penalites boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS texte_pied text;

-- Les mêmes bornes que sur `entreprises` (0040). Elles s'écrivent ici AUSSI,
-- et non « puisque la source est déjà bornée » : le jour où une reprise de
-- données écrira dans `devis` sans passer par `normaliserConditions`, c'est
-- cette contrainte-là qui refusera un acompte à 300 %.
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_acompte_pourcent_borne;
ALTER TABLE devis
  ADD CONSTRAINT devis_acompte_pourcent_borne
  CHECK (acompte_pourcent IS NULL OR (acompte_pourcent > 0 AND acompte_pourcent <= 100));

ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_delai_paiement_jours_borne;
ALTER TABLE devis
  ADD CONSTRAINT devis_delai_paiement_jours_borne
  CHECK (delai_paiement_jours IS NULL OR (delai_paiement_jours BETWEEN 0 AND 120));
