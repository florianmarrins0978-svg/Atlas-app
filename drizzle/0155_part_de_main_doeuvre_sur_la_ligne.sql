-- LA MAIN D'ŒUVRE RÉPARTIE SUR LES TRAVAUX D'UN DEVIS ÉCRIT — sa planche du
-- 1er novembre 2026 (appli/soignee/chantier.html?ecran=devis), puis ses mots,
-- « code le, pas de batterie ».
--
-- Répartie, la main d'œuvre ne fait pas de ligne à elle : chaque travail en
-- reçoit une part, qui s'ajoute à son prix. Sans la GARDER, « dont main
-- d'œuvre HT » ne la verrait plus (il ne compte que les lignes marquées main
-- d'œuvre, migration 0130) : le client lirait un devis sans main d'œuvre alors
-- qu'il en paie. La part se garde donc sur la ligne, recopiée sur le devis
-- comme le drapeau (src/lib/main-doeuvre-devis.ts en fait la somme).
--
-- Étendre seulement (.claude/rules/deployment-safety.md) : colonne nullable,
-- sans valeur par défaut ; l'ancien code qui ne la nomme pas reste juste, et
-- aucune ligne existante n'est réécrite (nulle veut dire « aucune part », ce
-- qu'elles portaient). Aucun UPDATE : la RLS forcée n'entre pas en jeu.
ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "part_main_doeuvre" numeric(12, 2);
ALTER TABLE "lignes_devis" ADD COLUMN IF NOT EXISTS "part_main_doeuvre" numeric(12, 2);
