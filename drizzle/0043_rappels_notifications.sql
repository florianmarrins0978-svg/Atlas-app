-- Les deux rappels que la rubrique « Notifications » peut vraiment tenir.
--
-- Dessiné le 13 août 2026 (`maquettes/atlas-reglages-notifications.html`), codé
-- le 14. La planche listait HUIT familles d'alertes ; une seule existait, et
-- elle le disait — « rien ne part encore sur votre téléphone ».
--
-- CES DEUX-LÀ SE CALCULENT AVEC CE QUE LA BASE PORTE DÉJÀ : un devis parti sans
-- réponse (`envois_devis.envoye_at`, `reponse IS NULL`), et un chantier terminé
-- sans facture (`chantiers.termine_at`, `facture_envoyee_at IS NULL`). Aucun
-- nouveau jalon, aucun nouveau geste du patron.
--
-- LES SIX AUTRES ATTENDENT UNE DONNÉE QUI N'EXISTE PAS, au premier rang de
-- laquelle « cette facture est payée » — que rien n'enregistre aujourd'hui. Une
-- alerte « facture impayée » bâtie sans elle hurlerait sur toutes les factures,
-- pour toujours.
--
-- NULLE VEUT DIRE « ÉTEINT ». Pas de colonne « actif » à côté de chaque nombre :
-- deux champs pour une seule idée finissent par se contredire.
--
-- ET LE DÉFAUT EST ALLUMÉ, délibérément. Un rappel éteint d'origine n'est jamais
-- découvert : il faudrait aller le chercher dans un écran de réglages pour
-- savoir qu'il existe. Sept et trois jours sont des délais de métier.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS rappel_devis_sans_reponse_jours integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS rappel_chantier_non_facture_jours integer DEFAULT 3;

UPDATE entreprises SET rappel_devis_sans_reponse_jours = 7
  WHERE rappel_devis_sans_reponse_jours IS NULL;
UPDATE entreprises SET rappel_chantier_non_facture_jours = 3
  WHERE rappel_chantier_non_facture_jours IS NULL;

-- Des bornes POSÉES EN BASE, et pas seulement à l'écran : une adresse d'action
-- se tape, et un rappel à 4 000 jours serait un rappel qui ne vient jamais.
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_rappel_devis_bornes,
  ADD CONSTRAINT entreprises_rappel_devis_bornes
    CHECK (rappel_devis_sans_reponse_jours IS NULL
           OR (rappel_devis_sans_reponse_jours BETWEEN 1 AND 90));

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_rappel_facture_bornes,
  ADD CONSTRAINT entreprises_rappel_facture_bornes
    CHECK (rappel_chantier_non_facture_jours IS NULL
           OR (rappel_chantier_non_facture_jours BETWEEN 1 AND 90));

COMMENT ON COLUMN entreprises.rappel_devis_sans_reponse_jours IS
  'Rappeler un devis parti sans réponse au bout de N jours. NULL = éteint.';
COMMENT ON COLUMN entreprises.rappel_chantier_non_facture_jours IS
  'Rappeler un chantier terminé et non facturé au bout de N jours. NULL = éteint.';
