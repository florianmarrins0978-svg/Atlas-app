-- Les travaux supplémentaires, ajoutés sur la facture avant son envoi.
--
-- Son constat du 31 août 2026 : « si on effectue des travaux en plus chez un
-- client, on n'a aucun moyen de rajouter les TS sur la facture ». Puis son
-- idée, capture de l'écran à l'appui : « depuis cette page, avant d'envoyer la
-- facture, il faut pouvoir la modifier en stipulant que c'est du TS, et comme
-- ça on a déjà toute la chaîne de production de créée pour l'envoyer au
-- client ».
--
-- Trois colonnes sur la ligne de facture, et pas une de plus :
--
--   · `origine`  — ce qui vient du devis, ce qui s'est ajouté. C'est ce qui
--     permet au document de les montrer en DEUX BLOCS : le client retrouve au
--     centime le prix qu'il avait accepté. Fondu dans les lignes du devis, un
--     supplément fait lire un total qui ne correspond plus, et il appelle.
--
--   · `taux_tva` — sa question du 1er septembre : « est-il possible que les TS
--     n'aient pas la même TVA ? ». Oui : 5,5 % l'entretien, 10 % les travaux
--     sur un logement de plus de deux ans, 20 % la création et les
--     professionnels. Et l'ARTICLE 268 bis DU CGI taxe EN ENTIER au taux le
--     plus élevé une facture qui ne ventile pas ses taux — un supplément à
--     20 % noyé dans une facture à 10 % ferait passer toute la facture à 20 %,
--     à la charge de l'artisan.
--
--     NULLE pour tout ce qui existe déjà, et c'est délibéré : la ligne prend
--     alors le taux de sa facture (`factures.taux_tva`), et les milliers de
--     lignes déjà émises sortent identiques à elles-mêmes.
--
--   · `unite` — « 12 m² », « 2 jours ». La ligne de devis la porte depuis la
--     migration 0070 ; sans elle ici, « 12 × 6,00 € » ne dit pas 12 de quoi,
--     et la facture est la pièce que le client garde.
--
-- Aucune donnée n'est réécrite : `origine` vaut 'devis' pour l'existant, ce
-- qu'il est.

ALTER TABLE lignes_facture
  ADD COLUMN IF NOT EXISTS origine text NOT NULL DEFAULT 'devis',
  ADD COLUMN IF NOT EXISTS taux_tva numeric(5, 2),
  ADD COLUMN IF NOT EXISTS unite text;

ALTER TABLE lignes_facture
  DROP CONSTRAINT IF EXISTS lignes_facture_origine_ck;
ALTER TABLE lignes_facture
  ADD CONSTRAINT lignes_facture_origine_ck
  CHECK (origine IN ('devis', 'supplement'));

-- Un taux hors bornes ne se corrige pas après coup : il part chez le client et
-- dans la déclaration. La base refuse, l'écran borne avant d'arriver ici.
ALTER TABLE lignes_facture
  DROP CONSTRAINT IF EXISTS lignes_facture_taux_tva_ck;
ALTER TABLE lignes_facture
  ADD CONSTRAINT lignes_facture_taux_tva_ck
  CHECK (taux_tva IS NULL OR (taux_tva >= 0 AND taux_tva <= 100));

COMMENT ON COLUMN lignes_facture.origine IS
  'devis : recopiée du devis à la création de la facture. supplement : ajoutée à l''arrêt 3, avant envoi.';
COMMENT ON COLUMN lignes_facture.taux_tva IS
  'Le taux de CETTE ligne. Nul pour les lignes d''avant la migration 0073 : le taux de la facture s''applique alors.';
COMMENT ON COLUMN lignes_facture.unite IS
  'L''unité de la quantité — « m² », « ml », « jour ». Nulle : la quantité s''écrit seule.';
