-- MR, MME OU ENTREPRISE, ET LE DEVIS EN SOUS-TRAITANCE — ses choix du
-- 4 octobre 2026 (`appli/ni-mr-ni-mme.html`, `appli/devis-sous-traitance.html`).
--
-- Expand seul. Aucune ligne existante n'est réécrite : les contraintes de
-- civilité s'ÉLARGISSENT (tout ce qui passait passe encore), les colonnes
-- neuves sont nulles ou à `false`, ce que l'ancien code ignore
-- (.claude/rules/deployment-safety.md, .claude/rules/migrations.md).
--
-- 1. « Entreprise », troisième civilité du client : le nom s'écrit seul, sans
--    « Mr. » (`avecCivilite`). Recopiée sur le devis et la facture comme les
--    deux autres (0038).
ALTER TABLE clients  DROP CONSTRAINT IF EXISTS clients_civilite_connue;
ALTER TABLE clients  ADD  CONSTRAINT clients_civilite_connue
  CHECK (civilite IS NULL OR civilite IN ('mr', 'mme', 'entreprise'));
ALTER TABLE devis    DROP CONSTRAINT IF EXISTS devis_client_civilite_connue;
ALTER TABLE devis    ADD  CONSTRAINT devis_client_civilite_connue
  CHECK (client_civilite IS NULL OR client_civilite IN ('mr', 'mme', 'entreprise'));
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_client_civilite_connue;
ALTER TABLE factures ADD  CONSTRAINT factures_client_civilite_connue
  CHECK (client_civilite IS NULL OR client_civilite IN ('mr', 'mme', 'entreprise'));

-- 2. Le SIRET d'une entreprise cliente, saisi sur sa fiche et recopié sur le
--    devis et la facture (sous le nom du client). Le numéro de TVA vit déjà
--    sur la fiche (0118).
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS siret text;
ALTER TABLE devis    ADD COLUMN IF NOT EXISTS client_siret text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_siret text;

-- 3. Le devis en sous-traitance (son choix B : décoché d'office). L'état vit
--    sur le CHANTIER, parce que ses lignes de prix y vivent et que chaque
--    version du devis en repart ; basculer met leurs taux à zéro et garde ceux
--    d'avant, comme la facture (0118). Le devis fige ce qu'il portait.
ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS autoliquidation boolean NOT NULL DEFAULT false;
ALTER TABLE chantiers ADD COLUMN IF NOT EXISTS taux_avant_autoliquidation jsonb;
ALTER TABLE devis     ADD COLUMN IF NOT EXISTS autoliquidation boolean NOT NULL DEFAULT false;
ALTER TABLE devis     ADD COLUMN IF NOT EXISTS client_numero_tva text;
