-- LES TRAVAUX ÉCRITS À LA MAIN — sa réponse « oui, et 1 » du 7 octobre 2026
-- (`appli/travaux-sans-devis.html`).
--
-- Un client se pose au planning sans devis depuis le 10 septembre ; la fiche
-- d'intervention n'avait alors rien à faire cocher, faute de lignes de devis.
-- Ce qu'il écrit à la main vit ici, sur le chantier. Dès qu'un devis PART,
-- ses lignes prennent la place de cette liste à l'écran (son choix 1) : la
-- colonne n'est pas vidée pour autant, elle cesse seulement d'être lue.
--
-- Expand seul : une colonne à valeur par défaut vide, aucune ligne réécrite.
-- L'ancien code l'ignore ; le code neuf servi sans elle tomberait, d'où son
-- arrivée avant lui (`.claude/rules/deployment-safety.md`).
--
-- Aucun `UPDATE`, donc rien à prouver sous FORCE RLS.
--
-- Bornée à 100 travaux : elle descend avec chaque ouverture de la fiche, et
-- un devis de trois pages en compte bien moins. La longueur de chacun (200)
-- se tient dans le code, une contrainte par élément de tableau n'existant
-- pas en SQL sans fonction.
ALTER TABLE chantiers
  ADD COLUMN IF NOT EXISTS travaux_a_la_main text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE chantiers
  DROP CONSTRAINT IF EXISTS chantiers_travaux_a_la_main_bornes;
ALTER TABLE chantiers
  ADD CONSTRAINT chantiers_travaux_a_la_main_bornes CHECK (cardinality(travaux_a_la_main) <= 100);
