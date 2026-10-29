-- IMPORTER UN TABLEAU DE DEVIS ET FACTURES — ses réponses du 28 octobre 2026,
-- planche `appli/soignee/clients-importer.html`, règles `src/lib/import-tableau.ts`.
--
-- Une ligne de tableau n'a pas de PDF : la pièce se garde par ce que le tableau
-- dit d'elle (numéro, date, montant, nom), plus son titre et l'adresse de son
-- chantier. Il a dit oui à cette migration le soir même, à la question posée
-- telle quelle (`CLAUDE.md` §0, point 9 ; `TODO.md`).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une contrainte
-- relâchée, une borne relevée, trois colonnes ajoutées. Aucune ligne réécrite,
-- donc rien à prouver sous FORCE RLS. L'ancien code ne crée aucune pièce sans
-- fichier et ignore les colonnes neuves ; la borne relevée et le `NOT NULL`
-- retiré ne refusent rien de ce qu'il écrit.

-- Une pièce d'un tableau n'a pas de fichier.
ALTER TABLE "pieces_importees" ALTER COLUMN "fichier_cle" DROP NOT NULL;

-- Son titre (la colonne « Objet ») et l'adresse de son chantier, quand elle
-- n'est pas celle du client (sa remarque du 28 octobre : « l'adresse du client
-- plus l'adresse du chantier, qui ne sont pas au même endroit »).
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "objet" text
  CHECK ("objet" IS NULL OR length("objet") <= 200);
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "adresse_chantier" text
  CHECK ("adresse_chantier" IS NULL OR length("adresse_chantier") <= 300);

-- Dix ans de pièces en un tableau : la planche en range 5 120. Deux mille
-- bornait un envoi de PDF ; un tableau en porte vingt mille au plus
-- (`LIGNES_MAX`). Les envois existants en ont tous moins : la contrainte
-- relevée ne peut refuser aucune ligne déjà là.
ALTER TABLE "envois_pieces" DROP CONSTRAINT IF EXISTS "envois_pieces_attendues_check";
ALTER TABLE "envois_pieces" ADD CONSTRAINT "envois_pieces_attendues_check"
  CHECK ("attendues" > 0 AND "attendues" <= 20000);

-- Ce que l'import a écrit dans des cases VIDES de fiches déjà là (sa réponse :
-- « compléter les cases vides »), pour qu'« Annuler » les vide à nouveau, et
-- seulement si personne ne les a changées depuis.
ALTER TABLE "envois_pieces" ADD COLUMN IF NOT EXISTS "cases_completees" jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "pieces_importees"."fichier_cle" IS 'NULL : une ligne de tableau, sans PDF (28 octobre 2026).';
