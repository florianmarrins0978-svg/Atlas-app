-- LE TITRE D'UN PDF IMPORTÉ : sa remarque du 3 novembre 2026, capture de son
-- devis Beseme à l'appui, « objet et titre, c'est la même chose », et la fiche
-- ne montrait que le numéro. La ligne « Objet » d'un PDF se lit désormais, dans
-- la colonne `objet` qu'un tableau remplit déjà (migration 0154).
--
-- Un PDF importé AVANT se relit une fois, au texte seul, à l'ouverture de sa
-- fiche (`chercherLesObjets`) : cette date dit qu'il l'a été, qu'un objet ait
-- été trouvé ou non, pour qu'il ne se relise pas à chaque ouverture.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne vide
-- ajoutée, aucune ligne réécrite, donc rien à prouver sous FORCE RLS. L'ancien
-- code l'ignore.

ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "objet_cherche_le" timestamptz;
