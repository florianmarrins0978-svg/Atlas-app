-- Plusieurs TVA sur un même devis : le taux descend sur la LIGNE.
--
-- Sa demande du 1er septembre 2026 : « sur la page du devis, si j'ai de la main
-- d'œuvre TVA à 20 et des plantes TVA à 10, je peux avoir deux TVA
-- différentes ? » Non — le devis n'en portait qu'une seule, `devis.taux_tva`,
-- posée sur la totalité du document.
--
-- CE QU'IL A TRANCHÉ, ET QUI CHANGE LA FORME DE L'ÉCRAN. Une première
-- proposition mettait une colonne TVA sur chaque ligne. Il a répondu : « il ne
-- faut pas la rajouter à chaque ligne, mais lorsque j'ai plusieurs choses à
-- rajouter j'appuie sur ajouter une TVA, une catégorie s'ajoute, et là je mets
-- toutes mes lignes qui seront en TVA à 10 ». Il a raison : sur un téléphone,
-- poser le même taux sur huit lignes fait huit gestes et huit occasions de se
-- tromper d'un chiffre — et un taux faux ne se voit pas sur le devis, il se
-- voit à la déclaration.
--
-- LA CATÉGORIE EST UNE VUE, PAS UNE TABLE — et c'est délibéré. Le taux vit sur
-- la ligne ; l'écran groupe les lignes qui partagent le même. Une table de
-- catégories aurait fait deux sources à tenir d'accord (`CLAUDE.md` §3), avec
-- la question sans réponse de ce qu'on fait d'une catégorie vide dont les
-- lignes sont parties ailleurs.
--
-- NULLE VEUT DIRE « SUIT LE DOCUMENT », ET C'EST CE QUI PROTÈGE L'EXISTANT.
-- Toutes les lignes déjà écrites restent nulles : elles prennent
-- `devis.taux_tva` comme avant, et pas un seul devis émis ne change d'un
-- centime. Aucune reprise de données, donc aucune occasion de s'y tromper.
--
-- `devis.taux_tva` NE DISPARAÎT PAS : il reste le taux du document, celui
-- qu'une ligne sans taux suit, et celui de la première catégorie.

ALTER TABLE lignes_prix
  ADD COLUMN IF NOT EXISTS taux_tva numeric(5, 2);

ALTER TABLE lignes_devis
  ADD COLUMN IF NOT EXISTS taux_tva numeric(5, 2);

ALTER TABLE lignes_facture
  ADD COLUMN IF NOT EXISTS taux_tva numeric(5, 2);

-- Les mêmes bornes que le prix accordé au client (`BORNES_REDUCTION`), pour la
-- même raison : un doigt qui glisse sur « 200 » ne doit pas fabriquer une TVA
-- de 200 % sur une pièce qui part chez un client.
ALTER TABLE lignes_prix DROP CONSTRAINT IF EXISTS lignes_prix_taux_tva_ck;
ALTER TABLE lignes_prix
  ADD CONSTRAINT lignes_prix_taux_tva_ck
  CHECK (taux_tva IS NULL OR (taux_tva >= 0 AND taux_tva <= 100));

ALTER TABLE lignes_devis DROP CONSTRAINT IF EXISTS lignes_devis_taux_tva_ck;
ALTER TABLE lignes_devis
  ADD CONSTRAINT lignes_devis_taux_tva_ck
  CHECK (taux_tva IS NULL OR (taux_tva >= 0 AND taux_tva <= 100));

ALTER TABLE lignes_facture DROP CONSTRAINT IF EXISTS lignes_facture_taux_tva_ck;
ALTER TABLE lignes_facture
  ADD CONSTRAINT lignes_facture_taux_tva_ck
  CHECK (taux_tva IS NULL OR (taux_tva >= 0 AND taux_tva <= 100));

COMMENT ON COLUMN lignes_prix.taux_tva IS
  'Le taux de SA catégorie. Nul : la ligne suit le taux du devis — c''est le cas de toutes celles écrites avant la migration 0073.';
COMMENT ON COLUMN lignes_devis.taux_tva IS
  'Recopié de la ligne de prix au moment où le devis est préparé. Un document garde ce qu''il portait.';
COMMENT ON COLUMN lignes_facture.taux_tva IS
  'Recopié du devis à la facturation. Sans lui, une facture à deux TVA se réglerait sur un seul taux.';
