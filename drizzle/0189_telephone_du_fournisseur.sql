-- LE TÉLÉPHONE D'UN FOURNISSEUR OU D'UN PARTENAIRE.
--
-- Sa planche du 19 novembre 2026, codée le 20 (`appli/fournisseur-depuis-son-
-- devis.html`) : un devis déposé sans choisir la société crée sa fiche, avec
-- son nom, son mail et son téléphone lus sur le document ; un fournisseur
-- qu'il a déjà reçoit le numéro qui lui manquait.
--
--   · `societes_achat.telephone` : tel qu'il est écrit, au plus 30 caractères
--     (`lireTelephone`, `src/lib/prix-achat.ts`). NULL sur toute société
--     d'avant.
--
-- **EXPAND SEUL** : une colonne NULL, aucune ligne lue ni réécrite. Les droits
-- de la table couvrent la colonne.

ALTER TABLE "societes_achat" ADD COLUMN IF NOT EXISTS "telephone" text;
ALTER TABLE "societes_achat" DROP CONSTRAINT IF EXISTS "societes_achat_telephone_longueur";
ALTER TABLE "societes_achat" ADD CONSTRAINT "societes_achat_telephone_longueur" CHECK (char_length("telephone") <= 30);
