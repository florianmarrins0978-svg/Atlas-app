-- LE DOSSIER DU COMPTABLE EN TROIS FICHIERS : un PDF, un Excel et un FEC
-- d'import, rangés par catégorie, chaque catégorie avec son numéro de compte.
--
-- Ses choix du 24 novembre 2026 (`appli/soignee/comptable-trois-fichiers.html`,
-- `appli/soignee/ticket-lisible.html`, `TODO.md`) et son « on code tout » du
-- même soir.
--
--   · `mouvements_bancaires.categorie_comptable` : la catégorie que le patron a
--     CHOISIE pour une ligne. Vide, la ligne prend celle que sa pièce dit
--     (`categorieProposee`, `src/lib/categories-comptables.ts`). La liste des
--     catégories vit dans le code, et lui seul la relit : une contrainte ici
--     obligerait une migration à chaque catégorie ajoutée.
--
--   · `entreprises.numeros_comptes` : les numéros qu'il (ou son comptable) a
--     changés dans Réglages, par catégorie. Vide : ceux que Cause propose.
--
--   · `dossiers_comptables.excel_cle` et `fec_cle` : les deux fichiers rangés à
--     côté du PDF, au même instant que lui. Vides pour un dossier d'avant : il
--     n'avait que son PDF, et rien ne se réécrit (la table ne se met pas à
--     jour, 0144).
--
--   · `achats_tva.photo_nette_cle` : la photo du ticket recadrée et nettoyée
--     dans le téléphone. La photo d'origine reste à côté, telle quelle : c'est
--     elle la pièce.
--
-- **EXPAND SEUL** : des colonnes vides, ou à valeur par défaut. Aucune ligne
-- existante n'est lue ni réécrite ; le code d'avant les ignore et tourne tel
-- quel. Les droits des tables valent pour leurs nouvelles colonnes.

ALTER TABLE "mouvements_bancaires" ADD COLUMN IF NOT EXISTS "categorie_comptable" text;

ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "numeros_comptes" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "dossiers_comptables" ADD COLUMN IF NOT EXISTS "excel_cle" text;
ALTER TABLE "dossiers_comptables" ADD COLUMN IF NOT EXISTS "fec_cle" text;

ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "photo_nette_cle" text;
