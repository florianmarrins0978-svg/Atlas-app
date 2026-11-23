-- LA FORMULE QUI COMMENCE À L'ÉCHÉANCE.
--
-- Sa décision du 23 novembre 2026 (planche `appli/soignee/changer-de-formule.html`,
-- `src/lib/changement-de-formule.ts`) : descendre ne débite rien, la formule
-- moins chère commence à l'échéance, et jusque-là il garde celle qu'il a
-- payée. L'article 14.6 le promettait déjà ; le code passait au contraire la
-- formule tout de suite, au prorata.
--
-- Le prestataire tient le calendrier du changement ; l'écran, lui, doit dire
-- « Jusqu'au 23 décembre, puis Artisan » sans l'interroger à chaque affichage
-- (la raison de 0084 : l'état vit ici, recopié). D'où ces deux colonnes :
-- ce qui commence à l'échéance, écrit quand il confirme la descente, effacé
-- quand il la retire (« Garder Entreprise ») ou quand le prestataire n'a plus
-- de calendrier. Le crochet s'en sert aussi pour savoir qu'une descente
-- CONFIRMÉE par lui vient de prendre effet : c'est la seule à pouvoir retirer
-- les comptes en trop.
--
-- **EXPAND SEUL** : deux colonnes NULL, aucune ligne lue ni réécrite. Le code
-- d'avant les ignore et tourne tel quel ; les contraintes portent sur des NULL
-- dans toute base habitée, et passent donc sans rien toucher.

ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "formule_prevue" text;
ALTER TABLE "abonnements" ADD COLUMN IF NOT EXISTS "periodicite_prevue" text;

ALTER TABLE "abonnements"
  ADD CONSTRAINT "abonnements_formule_prevue_connue"
    CHECK ("formule_prevue" IS NULL OR "formule_prevue" IN ('artisan', 'entreprise', 'illimite'));
ALTER TABLE "abonnements"
  ADD CONSTRAINT "abonnements_periodicite_prevue_connue"
    CHECK ("periodicite_prevue" IS NULL OR "periodicite_prevue" IN ('mensuelle', 'annuelle'));
-- Les deux ensemble ou aucune : une formule prévue sans son rythme ne dirait
-- pas ce qui sera débité.
ALTER TABLE "abonnements"
  ADD CONSTRAINT "abonnements_changement_prevu_entier"
    CHECK (("formule_prevue" IS NULL) = ("periodicite_prevue" IS NULL));
