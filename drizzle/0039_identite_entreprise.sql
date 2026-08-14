-- L'identité de l'entreprise : ce qu'un artisan doit pouvoir déclarer avant son
-- premier devis (ARCHITECTURE.md §87, maquettes/atlas-reglages-identite.html).
--
-- POURQUOI CES QUATRE COLONNES, ET PAS D'AUTRES.
--
-- `entreprises` portait six champs — nom, siret, adresse, telephone, email,
-- iban — et rien pour dire QUI l'on est fiscalement. Il manquait donc :
--
--   · `forme_juridique` : « SASU », « EI », « EURL ». Elle figure sur les
--     documents et se saisissait nulle part.
--   · `regime_tva` : LE point qui compte. Jusqu'ici `facture-pdf.ts` DEVINAIT
--     le régime en regardant si le taux appliqué valait zéro — donc il déduisait
--     une situation fiscale d'un chiffre saisi chantier par chantier. Les deux
--     sens sont faux : un artisan en franchise qui laisse 20 % par mégarde perd
--     une mention obligatoire ; un assujetti qui pose 0 % voit s'imprimer sur sa
--     facture une phrase qui ne le concerne pas. Le régime se DÉCLARE.
--   · `numero_tva` : la mention attendue sur la facture d'un assujetti.
--     RÉSERVE, écrite plutôt que tue : le détail des mentions obligatoires n'a
--     pas pu être vérifié à sa source depuis l'environnement de développement
--     (le mandataire réseau refuse les sites publics). À faire confirmer par un
--     comptable — même règle que docs/A-FAIRE.md §6, qui ne cite aucun tarif.
--   · `titulaire_compte` : un IBAN à un nom différent de l'entreprise inquiète
--     le client au lieu de le rassurer.
--
-- LE DÉFAUT DE `regime_tva` EST « assujettie », ET CE N'EST PAS ANODIN.
-- Une entreprise déjà en base a produit des factures avec un taux non nul dans
-- l'immense majorité des cas ; poser « franchise » par défaut ferait apparaître
-- « TVA non applicable » sur les prochaines factures d'artisans qui la
-- facturent. Le défaut le moins dangereux est celui qui ne change RIEN au
-- comportement observé jusqu'ici pour un assujetti — et qui, pour une franchise,
-- se corrige d'un geste dans les réglages.

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS forme_juridique  text,
  ADD COLUMN IF NOT EXISTS regime_tva       text NOT NULL DEFAULT 'assujettie',
  ADD COLUMN IF NOT EXISTS numero_tva       text,
  ADD COLUMN IF NOT EXISTS titulaire_compte text;

-- Deux valeurs, et pas une de plus : tout autre mot ferait un régime inconnu
-- que `facture-pdf.ts` ne saurait pas imprimer, et il imprimerait alors au
-- hasard. Mieux vaut que la base refuse.
ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_regime_tva_ck;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_regime_tva_ck
  CHECK (regime_tva IN ('assujettie', 'franchise'));

COMMENT ON COLUMN entreprises.regime_tva IS
  'assujettie | franchise. Déclaré, jamais déduit du taux appliqué : la mention de l''article 293 B en dépend.';
COMMENT ON COLUMN entreprises.numero_tva IS
  'Numéro de TVA intracommunautaire. Attendu sur la facture d''un assujetti — à faire confirmer par un comptable.';

-- ─── Le régime est FIGÉ DANS LA FACTURE, comme le reste de l'identité ──────
--
-- Une facture garde l'identité qu'elle portait le jour de son émission
-- (ARCHITECTURE.md §87). Le régime de TVA n'y échappe pas : une facture émise
-- sous franchise doit conserver sa mention « art. 293 B » même si l'artisan
-- devient assujetti l'année suivante. La lire en direct depuis `entreprises`
-- réécrirait le passé — sur une pièce comptable.
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS entreprise_regime_tva text;

-- LES FACTURES DÉJÀ ÉMISES GARDENT CE QU'ELLES ONT IMPRIMÉ. Jusqu'ici la
-- mention se déduisait du taux appliqué ; on recopie donc cette déduction, une
-- dernière fois, pour que l'historique reste exact. Poser 'assujettie' partout
-- aurait fait disparaître la mention de factures qui la portaient.
UPDATE factures
   SET entreprise_regime_tva = CASE WHEN taux_tva = 0 THEN 'franchise' ELSE 'assujettie' END
 WHERE entreprise_regime_tva IS NULL;

ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS factures_regime_tva_ck;
ALTER TABLE factures
  ADD CONSTRAINT factures_regime_tva_ck
  CHECK (entreprise_regime_tva IS NULL OR entreprise_regime_tva IN ('assujettie', 'franchise'));

COMMENT ON COLUMN factures.entreprise_regime_tva IS
  'Le régime au jour de l''émission. Nul pour les factures antérieures à la migration 0039 : le PDF se rabat alors sur le taux, comme avant.';
