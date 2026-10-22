-- LE CLIENT PUBLIC, ET SA FACTURE POUR CHORUS PRO — ses choix du
-- 22 octobre 2026 (`appli/facture-mairie-chorus.html`).
--
-- Expand seul. Aucune ligne existante n'est réécrite : les contraintes de
-- civilité s'ÉLARGISSENT (tout ce qui passait passe encore), les colonnes
-- neuves sont nulles, ce que l'ancien code ignore
-- (.claude/rules/deployment-safety.md, .claude/rules/migrations.md). Aucune
-- écriture de données : la FORCE RLS des trois tables n'a rien à voir passer.
--
-- 1. « Public », quatrième civilité du client : une mairie, un département,
--    une communauté de communes. Recopiée sur le devis et la facture comme
--    les trois autres (0038, 0119).
ALTER TABLE clients  DROP CONSTRAINT IF EXISTS clients_civilite_connue;
ALTER TABLE clients  ADD  CONSTRAINT clients_civilite_connue
  CHECK (civilite IS NULL OR civilite IN ('mr', 'mme', 'entreprise', 'public'));
ALTER TABLE devis    DROP CONSTRAINT IF EXISTS devis_client_civilite_connue;
ALTER TABLE devis    ADD  CONSTRAINT devis_client_civilite_connue
  CHECK (client_civilite IS NULL OR client_civilite IN ('mr', 'mme', 'entreprise', 'public'));
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_client_civilite_connue;
ALTER TABLE factures ADD  CONSTRAINT factures_client_civilite_connue
  CHECK (client_civilite IS NULL OR client_civilite IN ('mr', 'mme', 'entreprise', 'public'));

-- 2. Le code service, sur la fiche : il ne change pas d'une commande à
--    l'autre. Recopié sur chaque facture, où il se change pour elle seule
--    (une mairie a parfois plusieurs services qui commandent).
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS code_service text;

-- 3. Ce que la facture FIGE, comme le SIRET (0119) : une pièce garde ce
--    qu'elle portait le jour où elle est partie. Le numéro d'engagement change
--    à chaque bon de commande : il ne vit que sur la facture.
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_code_service text;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_numero_engagement text;
