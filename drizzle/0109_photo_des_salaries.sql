-- LA TÊTE DES GARS, À CÔTÉ DE LEUR NOM.
--
-- Sa demande du 27 septembre 2026 : *« dans le compte des salariés, mettre la
-- possibilité de mettre la tête des gars en photo »*. Planche
-- `appli/photo-des-salaries.html`, proposition B retenue : une fiche par
-- salarié, la photo en grand, prendre, choisir, retirer.
--
-- **La photo vit dans le stockage, la base garde sa clef** : le chemin du logo
-- (`entreprises.logo_storage_key`). `equipes` porte les salariés malgré son nom
-- (migration 0067).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne
-- nullable, aucune ligne existante touchée, aucun UPDATE sous FORCE RLS. Un
-- salarié sans photo est l'état normal, et l'ancien code l'ignore.

ALTER TABLE "equipes" ADD COLUMN "photo_storage_key" text;
