-- LE PRIX D'ACHAT QU'IL A CHOISI POUR UNE LIGNE, POUR LUI SEUL.
--
-- Sa planche du 20 novembre 2026 (`appli/le-prix-d-une-piece.html`) : sur un
-- devis tapé à la main, sous « Sac de terreau », ses prix enregistrés chez
-- chaque fournisseur ; il en touche un, le prix se pose avec sa marge, et le
-- fournisseur reste écrit sous la ligne (« Matériaux Garnier, 8,90 € HT le
-- sac »).
--
--   · `lignes_prix.achat_retenu` : cette phrase, recopiée au moment du choix.
--     Recopiée et non relue : le prix du fournisseur peut bouger, la ligne
--     garde celui qui l'a chiffrée. NULL sur toute ligne d'avant, et dès
--     qu'un prix est retapé à la main.
--
-- **Jamais chez le client** : la photographie du devis recopie ses champs un à
-- un (`devis.ts`), et celui-ci n'y est pas ; l'export des données d'un client
-- le retire (`donnees-client.ts`).
--
-- **EXPAND SEUL** : une colonne NULL, aucune ligne lue ni réécrite. Les droits
-- de la table couvrent la colonne.

ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "achat_retenu" text;
ALTER TABLE "lignes_prix" DROP CONSTRAINT IF EXISTS "lignes_prix_achat_retenu_longueur";
ALTER TABLE "lignes_prix" ADD CONSTRAINT "lignes_prix_achat_retenu_longueur" CHECK (char_length("achat_retenu") <= 300);
