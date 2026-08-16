-- Le quatrième rappel : une facture dont le règlement n'est pas arrivé.
--
-- Dessiné le 16 août 2026 (`maquettes/atlas-rappel-facture-impayee.html`), codé
-- le même jour sur sa réponse : « faut faire A plus B », puis « oui c'est bon,
-- code le ».
--
-- IL ÉTAIT IMPOSSIBLE LE MATIN MÊME. Rien n'enregistrait qu'une facture était
-- réglée ; une alerte bâtie là-dessus aurait crié sur toutes les factures, pour
-- toujours. La migration 0045 a posé `paiements_facture` et « l'endroit en
-- attente » : la donnée existe, le rappel devient possible.
--
-- « A PLUS B », ET C'EST LUI QUI L'A TRANCHÉ. L'échéance quand elle existe — le
-- délai de paiement réglé dans « Devis & factures » —, le jour de l'envoi
-- sinon. Le nombre ci-dessous se compte à partir de là. Plus aucun cas muet :
-- un rappel qui se tairait faute de réglage est un rappel qu'on croit allumé.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS rappel_facture_impayee_jours integer DEFAULT 1,
  -- LE RYTHME, sa demande du même jour : « je veux un rappel toutes les
  -- semaines ou tous les quinze jours, mais pas qu'il y ait la notification
  -- tous les jours ». Sans lui, la carte resterait à l'écran chaque jour
  -- jusqu'au paiement — et au bout d'une semaine on ne la lit plus.
  --
  -- JAMAIS NUL, contrairement au délai : ce n'est pas un interrupteur. On
  -- éteint le rappel par la colonne du dessus, et deux façons de l'éteindre
  -- finiraient par se contredire.
  ADD COLUMN IF NOT EXISTS rappel_facture_rythme_jours integer NOT NULL DEFAULT 7;

UPDATE entreprises SET rappel_facture_impayee_jours = 1
  WHERE rappel_facture_impayee_jours IS NULL;

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_rappel_impayee_bornes,
  ADD CONSTRAINT entreprises_rappel_impayee_bornes
    CHECK (rappel_facture_impayee_jours IS NULL
           OR (rappel_facture_impayee_jours BETWEEN 1 AND 90));

-- Les trois rythmes de sa planche, et eux seuls. Une case de saisie aurait
-- invité à écrire « 3 jours », ce qu'il vient précisément d'exclure.
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_rappel_rythme_connu,
  ADD CONSTRAINT entreprises_rappel_rythme_connu
    CHECK (rappel_facture_rythme_jours IN (1, 7, 15));

-- « PLUS TARD » : le jour où il a repoussé le rappel de CETTE facture.
--
-- SUR LE CHANTIER, ET PAS SUR LA FACTURE — et ce n'est pas un rangement.
-- `trg_facture_immuable` (migration 0018) refuse TOUTE écriture sur une facture
-- émise, y compris une date d'affichage : « Une facture émise est immuable ».
-- C'est un invariant comptable, et l'affaiblir pour une commodité d'écran
-- serait exactement ce que `CLAUDE.md` §4 interdit.
--
-- La relation est de un à un (`factures_chantier_uk`) : le chantier porte donc
-- la date sans qu'on perde rien. Constaté en suite, pas en relecture — l'essai
-- « Plus tard » a rougi sur le déclencheur.
--
-- UNE DATE CIVILE, pas un horodatage : « toutes les semaines » se compte en
-- jours, et un fuseau mal choisi ferait revenir la carte un jour trop tôt.
ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS rappel_facture_repousse_le date;

COMMENT ON COLUMN entreprises.rappel_facture_impayee_jours IS
  'Rappeler une facture impayée N jours après son échéance. NULL = éteint.';
COMMENT ON COLUMN entreprises.rappel_facture_rythme_jours IS
  'Tous les combien le rappel revient après un « Plus tard » : 1, 7 ou 15.';
COMMENT ON COLUMN chantiers.rappel_facture_repousse_le IS
  'Jour du dernier « Plus tard » sur le rappel d''impayé. NULL : jamais repoussé.';
