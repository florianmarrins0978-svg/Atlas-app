-- L'ADRESSE MAIL ET LE MESSAGE DE CHAQUE FOURNISSEUR, sa planche du 20 octobre
-- 2026 (`appli/arrosage-prix-par-fournisseur.html`, validée) : *« qu'il nous
-- ouvre le mail avec l'adresse du fournisseur déjà écrite »*, puis *« un
-- message personnalisé en fonction des fournisseurs, si je note son nom, que ça
-- le garde en mémoire pour les prochaines fois »*.
--
-- Le début (« Bonjour Julien, ») et la fin (« Merci, Florian ») se gardent ici ;
-- la liste du milieu, jamais : elle est refaite à chaque plan, sans prix.
--
-- Expand seul : trois colonnes vides d'office, aucune ligne touchée, aucune
-- contrainte qui lise les lignes déjà là (une colonne neuve vaut NULL partout).
-- Le code d'avant les ignore.

ALTER TABLE "societes_achat" ADD COLUMN IF NOT EXISTS "email" text
  CHECK ("email" IS NULL OR (length("email") <= 200 AND "email" LIKE '%_@_%' AND "email" !~ '\s'));
ALTER TABLE "societes_achat" ADD COLUMN IF NOT EXISTS "debut_mail" text
  CHECK ("debut_mail" IS NULL OR length("debut_mail") <= 2000);
ALTER TABLE "societes_achat" ADD COLUMN IF NOT EXISTS "fin_mail" text
  CHECK ("fin_mail" IS NULL OR length("fin_mail") <= 2000);
