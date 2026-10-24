-- POUR MON COMPTABLE, LOT 5 — le ticket recopié ligne par ligne.
-- Sa demande du 24 octobre 2026 : la pièce réécrite du dossier est le ticket
-- ENTIER, comme imprimé, rien de regroupé (`src/lib/ticket-imprime.ts`).
--
-- **EXPAND SEUL** : une colonne neuve, nulle par défaut. Les tickets d'avant
-- n'ont pas de lignes, et la pièce réécrite garde alors son résumé ; aucune
-- ligne existante n'est touchée, donc aucune question de RLS ici.
ALTER TABLE "achats_tva" ADD COLUMN IF NOT EXISTS "lignes_imprimees" jsonb;
COMMENT ON COLUMN "achats_tva"."lignes_imprimees" IS 'Chaque ligne imprimée du ticket, [{gauche, droite}], lue sur la photo et confirmée avec lui (24 octobre 2026).';
