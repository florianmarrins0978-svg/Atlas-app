-- Les conditions qui s'impriment sur un devis, réglées au lieu d'être en dur.
--
-- Dessiné le 13 août 2026 (`maquettes/atlas-reglages-documents.html`), codé le
-- 14. « Validité : 30 jours » était une CONSTANTE de `devis-pdf.ts`, la même
-- pour tous les artisans, qu'aucun écran ne montrait : un couvreur qui tient
-- ses prix quinze jours envoyait un devis qui l'engageait trente.
--
-- UNE VALEUR NULLE VEUT DIRE « ÉTEINT ». Pas de colonne « actif » à côté de
-- chaque nombre : deux champs pour une seule idée finissent par se contredire —
-- un acompte à 30 % et un interrupteur éteint, et plus personne ne sait ce qui
-- s'imprime.
--
-- SAUF POUR LA VALIDITÉ, dont le défaut est celui d'avant : 30 jours. Une
-- migration qui changerait ce qui s'imprime, sans qu'il l'ait demandé, ferait
-- partir des devis différents de ceux de la veille. Le rattrapage ci-dessous
-- pose donc 30 sur les entreprises existantes, et la valeur par défaut vaut
-- pour les suivantes.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS validite_devis_jours integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS acompte_pourcent numeric(5, 2),
  ADD COLUMN IF NOT EXISTS delai_paiement_jours integer,
  ADD COLUMN IF NOT EXISTS moyens_paiement text,
  ADD COLUMN IF NOT EXISTS rappeler_penalites_devis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS texte_pied_documents text;

UPDATE entreprises SET validite_devis_jours = 30 WHERE validite_devis_jours IS NULL;

-- Des bornes de bon sens, POSÉES EN BASE et pas seulement à l'écran : une
-- adresse d'action se tape, et un acompte de 4 000 % s'imprimerait sur un
-- document que le client garde.
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_validite_devis_jours_bornee;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_validite_devis_jours_bornee
  CHECK (validite_devis_jours IS NULL OR (validite_devis_jours BETWEEN 1 AND 365));

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_acompte_pourcent_borne;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_acompte_pourcent_borne
  CHECK (acompte_pourcent IS NULL OR (acompte_pourcent > 0 AND acompte_pourcent <= 100));

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_delai_paiement_jours_borne;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_delai_paiement_jours_borne
  CHECK (delai_paiement_jours IS NULL OR (delai_paiement_jours BETWEEN 0 AND 120));

-- ET LA VALIDITÉ SE FIGE DANS LE DEVIS, comme le reste de l'identité.
--
-- Un devis garde ce qu'il portait le jour où il a été créé — c'est la règle des
-- pièces émises (`ARCHITECTURE.md` §94), et elle vaut ici plus qu'ailleurs :
-- lire le réglage au moment de composer le PDF ferait changer la durée
-- d'engagement d'un devis DÉJÀ ENVOYÉ, simplement parce que l'artisan a corrigé
-- ses réglages entre-temps. Le client, lui, a une autre feuille sous les yeux.
--
-- Le rattrapage pose 30 sur les devis existants : c'est ce que la constante
-- écrivait, donc ce que ces devis-là disaient.
ALTER TABLE devis ADD COLUMN IF NOT EXISTS validite_jours integer;
UPDATE devis SET validite_jours = 30 WHERE validite_jours IS NULL;
