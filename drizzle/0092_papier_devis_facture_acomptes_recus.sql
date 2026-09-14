-- LE PAPIER, LE MÊME POUR LE DEVIS ET LA FACTURE — sa planche du 14 septembre
-- 2026 (appli/le-papier-devis-et-facture.html), codée sur son « PARFAIT ! Code
-- exactement cette planche, du devis à la facture ».
--
-- ════════════════════════════════════════════════════════════════════════════
-- UN TITRE, S'IL EN VEUT UN. *« Certains utilisateurs aiment mettre un titre sur
-- leur devis, genre devis chantier Machin ; faut pas que ça soit d'office »* :
-- NULL ou vide, rien ne s'imprime. Recopié du devis sur la facture — c'est le
-- même document, seul le titre du haut change.
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "titre" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "titre" text;

-- ════════════════════════════════════════════════════════════════════════════
-- CE QUE LA FACTURE NE SAVAIT PAS NOMMER. *« Quand on crée une facture on ne
-- peut pas rajouter la main d'œuvre »* : la même colonne que sur le devis
-- (0090), recopiée à la création, retouchable tant que la facture est en
-- brouillon. « Dont », jamais « plus » : aucun total ne bouge.
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "main_doeuvre_ht" numeric(12, 2);

-- L'unité manquait sur la ligne de facture : le devis la portait (0070) et la
-- recopie l'oubliait, donc « 3 ml » devenait « 3 » une fois facturé.
ALTER TABLE "lignes_facture" ADD COLUMN IF NOT EXISTS "unite" text;

-- ════════════════════════════════════════════════════════════════════════════
-- LES ACOMPTES REÇUS, SUR LA FACTURE. *« Chaque montant perçu avant la fin du
-- chantier est un acompte »* : un règlement porte son moyen (déjà là), et
-- désormais le NUMÉRO du chèque — c'est ce qui s'imprime dans « Montants
-- versés : chèque n° 1806028 du 02/09/2026, 522,23 € ».
ALTER TABLE "paiements_facture" ADD COLUMN IF NOT EXISTS "numero" text;

-- « Facture acquittée » est un interrupteur : allumé, le solde est compté reçu
-- à la date du jour. Ce règlement-là est marqué, pour deux raisons : il se
-- retire quand on éteint, et il s'écrit « Acompte » tout court — jamais avec
-- un taux du devis, qui n'est pas le sien.
ALTER TABLE "paiements_facture" ADD COLUMN IF NOT EXISTS "solde" boolean NOT NULL DEFAULT false;
