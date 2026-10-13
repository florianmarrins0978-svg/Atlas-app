-- LA MAIN D'ŒUVRE QUI S'ADDITIONNE — sa demande du 13 octobre 2026, la A de la
-- planche appli/devis-main-d-oeuvre-par-tva.html.
--
-- *« Dire main d'œuvre 500 € et que ça s'additionne comme une tâche normale,
-- pour les lignes TVA à 10 et TVA à 20. »* La main d'œuvre devient une LIGNE
-- ordinaire du devis (1 forfait, au taux de sa catégorie) : totaux, TVA par
-- taux, PDF et facture la portent sans un calcul de plus.
--
-- Ce drapeau ne sert qu'à la RECONNAÎTRE : « dont main d'œuvre HT », sous le
-- total, est la somme de ces lignes-là (src/lib/main-doeuvre-devis.ts). Le
-- libellé ne peut pas en tenir lieu — il le change au doigt.
--
-- Étendre seulement (.claude/rules/deployment-safety.md) : NOT NULL avec une
-- valeur par défaut, donc l'ancien code qui insère sans la nommer reste juste,
-- et aucune ligne existante n'est réécrite — toutes valent « pas main d'œuvre »,
-- ce qu'elles étaient. Aucun UPDATE : la RLS forcée n'entre pas en jeu.
ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "main_doeuvre" boolean NOT NULL DEFAULT false;
ALTER TABLE "lignes_devis" ADD COLUMN IF NOT EXISTS "main_doeuvre" boolean NOT NULL DEFAULT false;
