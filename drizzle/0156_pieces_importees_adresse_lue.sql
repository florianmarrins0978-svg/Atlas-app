-- LES PDF AU MÊME ÉCRAN « PAR CLIENT » QUE LES TABLEAUX, ET LEUR TITRE : sa demande du
-- 31 octobre 2026, « que ça soit un CSV, Excel ou un PDF, il faut que ça soit
-- la même chose ; il faut qu'ils se débrouillent tout seuls pour me les ranger
-- en client ». Planche `appli/soignee/clients-importer.html` (« Les PDF
-- arrivent au même écran, groupés par client »).
--
-- Pour qu'un PDF passe par la même règle qu'une ligne de tableau
-- (`planDeRangement`, zéro erreur sur une adresse), sa lecture doit garder ce
-- qu'un tableau donne en colonnes : l'adresse du client, son téléphone, et le
-- lieu des travaux quand il est écrit à part.
--
-- **Trois colonnes à part, et non `adresse_chantier`** : celle-ci porte ce que
-- le RANGEMENT a décidé (une seconde adresse du même client y va aussi). Y
-- écrire la lecture, c'était la polluer au premier « Annuler », puis relire au
-- rangement suivant une décision pour une lecture.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : des colonnes vides
-- ajoutées, aucune ligne réécrite, donc rien à prouver sous FORCE RLS.
-- L'ancien code les ignore.

ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "adresse_lue" text
  CHECK ("adresse_lue" IS NULL OR length("adresse_lue") <= 300);
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "telephone_lu" text
  CHECK ("telephone_lu" IS NULL OR length("telephone_lu") <= 40);
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "chantier_lu" text
  CHECK ("chantier_lu" IS NULL OR length("chantier_lu") <= 300);

-- Le titre d'un PDF (la ligne « Objet ») se lit désormais, dans la colonne
-- `objet` qu'un tableau remplit déjà. Sa remarque du 3 novembre 2026 : « objet
-- et titre, c'est la même chose », et la fiche ne montrait que le numéro. Un
-- PDF importé avant se relit UNE fois, à l'ouverture de sa fiche : cette date
-- dit qu'il l'a été, qu'un objet ait été trouvé ou non.
ALTER TABLE "pieces_importees" ADD COLUMN IF NOT EXISTS "objet_cherche_le" timestamptz;
