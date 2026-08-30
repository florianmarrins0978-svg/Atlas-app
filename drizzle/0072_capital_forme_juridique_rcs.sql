-- Le capital social et la ville du RCS, à côté de la forme juridique.
--
-- Sa demande du 30 août 2026 : pouvoir ajouter, s'il le veut, le capital ou la
-- forme juridique de sa société sur son devis, avec le nom de société ou seul
-- — puis la ville d'immatriculation au RCS (Code de commerce, art. R123-237).
--
-- CE QUI ÉTAIT DÉJÀ LÀ, ET NE SERVAIT À RIEN. `forme_juridique` existe depuis
-- la migration 0039 : on la choisit dans Identité, elle s'enregistre — et elle
-- n'est copiée dans AUCUN devis, AUCUNE facture, jamais dessinée sur un PDF.
-- Elle était donc lue, mais nulle part imprimée.
--
-- CE QUI EST NEUF ICI : `capital_social`, `ville_rcs`, et
-- `mentions_legales_position` qui dit OÙ — ou SI — les trois s'impriment :
-- sous le nom, en bas avec le SIRET, ou nulle part.
--
-- LE RCS NE REDEMANDE PAS DE SECOND NUMÉRO. C'est le SIREN, déjà les neuf
-- premiers chiffres du SIRET (`sirenDepuisSiret`, affiché sous ce champ dans
-- Identité). Une seconde saisie serait une seconde vérité à faire diverger
-- (`CLAUDE.md` §3) ; seule la ville d'immatriculation est une donnée neuve.
--
-- LE DÉFAUT EST « aucune », ET C'EST DÉLIBÉRÉ. Des entreprises ont déjà rempli
-- `forme_juridique` sans savoir qu'elle ne s'imprimait pas. La faire
-- apparaître d'un coup sur leur prochain devis serait une surprise sur une
-- pièce que le client garde — l'artisan choisit d'abord où, ou s'il, l'affiche.

ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS capital_social numeric(12, 2),
  ADD COLUMN IF NOT EXISTS ville_rcs text,
  ADD COLUMN IF NOT EXISTS mentions_legales_position text NOT NULL DEFAULT 'aucune';

ALTER TABLE entreprises
  DROP CONSTRAINT IF EXISTS entreprises_mentions_legales_position_ck;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_mentions_legales_position_ck
  CHECK (mentions_legales_position IN ('sous_nom', 'bas', 'aucune'));

COMMENT ON COLUMN entreprises.capital_social IS
  'En euros. Vide : rien ne s''imprime, comme les autres champs de l''identité.';
COMMENT ON COLUMN entreprises.ville_rcs IS
  'Ville d''immatriculation au RCS. Le numéro est le SIREN, déjà dans le SIRET.';
COMMENT ON COLUMN entreprises.mentions_legales_position IS
  'sous_nom | bas | aucune. Gouverne ensemble l''impression de la forme juridique + capital, et du RCS.';

-- ─── Figées dans le devis, comme le reste de l'identité ────────────────────
--
-- Un document garde l'identité qu'il portait le jour de son émission : changer
-- son capital social l'an prochain ne doit pas réécrire un devis déjà envoyé.

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS entreprise_forme_juridique text,
  ADD COLUMN IF NOT EXISTS entreprise_capital_social numeric(12, 2),
  ADD COLUMN IF NOT EXISTS entreprise_ville_rcs text,
  ADD COLUMN IF NOT EXISTS entreprise_mentions_legales_position text;

ALTER TABLE devis
  DROP CONSTRAINT IF EXISTS devis_mentions_legales_position_ck;
ALTER TABLE devis
  ADD CONSTRAINT devis_mentions_legales_position_ck
  CHECK (entreprise_mentions_legales_position IS NULL
         OR entreprise_mentions_legales_position IN ('sous_nom', 'bas', 'aucune'));

COMMENT ON COLUMN devis.entreprise_mentions_legales_position IS
  'Recopiée à la création. Nulle pour les devis antérieurs à la migration 0072 : rien de plus ne s''imprime.';

-- ─── Puis dans la facture, recopiées du devis ──────────────────────────────

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS entreprise_forme_juridique text,
  ADD COLUMN IF NOT EXISTS entreprise_capital_social numeric(12, 2),
  ADD COLUMN IF NOT EXISTS entreprise_ville_rcs text,
  ADD COLUMN IF NOT EXISTS entreprise_mentions_legales_position text;

ALTER TABLE factures
  DROP CONSTRAINT IF EXISTS factures_mentions_legales_position_ck;
ALTER TABLE factures
  ADD CONSTRAINT factures_mentions_legales_position_ck
  CHECK (entreprise_mentions_legales_position IS NULL
         OR entreprise_mentions_legales_position IN ('sous_nom', 'bas', 'aucune'));

COMMENT ON COLUMN factures.entreprise_mentions_legales_position IS
  'Recopiée du devis à la création de la facture. Nulle pour les factures antérieures à la migration 0072.';
