-- LE PRIX ACCORDÉ AU CLIENT — la remise commerciale, sous le total.
--
-- Le patron, le 16 août 2026 : « si jamais un client me demande une réduction,
-- [pouvoir] lui demander "fais cinq pour cent sur le montant du devis" [...]
-- c'est moi qui choisis le nombre de pourcentage ». Puis, sur la planche 61 :
-- « sous le total et prix accordé au client » — l'arrangement B, et son mot.
--
-- POURQUOI DEUX COLONNES ET NON UNE. Le pourcentage seul suffirait à recalculer
-- le montant… tant que personne ne touche aux lignes. Or les lignes bougent : un
-- devis se corrige après qu'une remise a été accordée. Le MONTANT est donc figé
-- avec le document, comme les totaux qui l'entourent, et le POURCENTAGE reste
-- pour l'écrire en toutes lettres. Les recalculer l'un depuis l'autre, c'est
-- accepter qu'ils divergent le jour où l'arrondi tombe mal.
--
-- CE QUE `total_ht` PORTE, ET C'EST LE CHOIX QUI FAIT TENIR LE RESTE : le
-- montant APRÈS réduction. Tout ce qui existe déjà — le relevé de TVA, l'export
-- comptable, le suivi des paiements, l'exigibilité — lit `total_ht` en croyant
-- lire ce qui est dû. Y laisser le prix plein aurait fait déclarer de la TVA sur
-- de l'argent que le client ne paie pas, et il aurait fallu corriger chacun de
-- ces endroits sans en oublier un seul.
--
-- NULLE VEUT DIRE « AUCUNE RÉDUCTION », jamais « zéro pour cent ». Un document
-- qui écrirait « Prix accordé au client 0,00 % — 0,00 € » n'apprend rien et fait
-- douter du reste. Les milliers de devis déjà émis restent donc exactement ce
-- qu'ils étaient : cette migration n'a aucun effet visible sur eux.
--
-- AUCUNE COLONNE POUR LE PRIX PLEIN. Il vaut `total_ht + reduction_montant`, et
-- une troisième colonne serait une troisième occasion de se contredire.

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS reduction_pourcent numeric(5,2),
  ADD COLUMN IF NOT EXISTS reduction_montant numeric(10,2);

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS reduction_pourcent numeric(5,2),
  ADD COLUMN IF NOT EXISTS reduction_montant numeric(10,2);

-- Les bornes en base, PARCE QUE L'ÉCRAN N'EST PAS LE SEUL CHEMIN. Une action
-- serveur, une dictée mal comprise ou une reprise de données passeraient à côté
-- de la validation de `src/lib/reduction-devis.ts`. Ici, un devis à −300 % est
-- refusé quel que soit celui qui l'écrit.
--
-- 100 % est ACCEPTÉ : un chantier offert existe, et le refuser serait décider à
-- la place du patron.
ALTER TABLE devis
  DROP CONSTRAINT IF EXISTS devis_reduction_pourcent_ck,
  ADD CONSTRAINT devis_reduction_pourcent_ck
    CHECK (reduction_pourcent IS NULL OR (reduction_pourcent > 0 AND reduction_pourcent <= 100));

ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS factures_reduction_pourcent_ck,
  ADD CONSTRAINT factures_reduction_pourcent_ck
    CHECK (reduction_pourcent IS NULL OR (reduction_pourcent > 0 AND reduction_pourcent <= 100));

-- Les deux colonnes vont ensemble ou pas du tout : un pourcentage sans montant
-- laisserait le document incapable de dire ce qu'il a retiré, et un montant sans
-- pourcentage l'empêcherait d'écrire la phrase.
ALTER TABLE devis
  DROP CONSTRAINT IF EXISTS devis_reduction_paire_ck,
  ADD CONSTRAINT devis_reduction_paire_ck
    CHECK ((reduction_pourcent IS NULL) = (reduction_montant IS NULL));

ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS factures_reduction_paire_ck,
  ADD CONSTRAINT factures_reduction_paire_ck
    CHECK ((reduction_pourcent IS NULL) = (reduction_montant IS NULL));

COMMENT ON COLUMN devis.reduction_pourcent IS
  'Le prix accordé au client, en pourcentage du HT. NULL = aucune réduction. La TVA se calcule sur total_ht, qui est DÉJÀ net.';
COMMENT ON COLUMN devis.reduction_montant IS
  'Ce qui a été retiré, en euros, figé avec le document. Le prix plein vaut total_ht + reduction_montant.';
COMMENT ON COLUMN factures.reduction_pourcent IS
  'Recopié du devis à la création de la facture : une remise accordée puis absente de la facture ferait payer au client ce qu''on venait de lui retirer.';
COMMENT ON COLUMN factures.reduction_montant IS
  'Ce qui a été retiré, en euros, figé avec la facture.';
