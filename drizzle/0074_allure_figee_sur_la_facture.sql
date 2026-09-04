-- L'ALLURE DES DOCUMENTS SE FIGE SUR LA FACTURE, AU MOMENT DE L'ENVOI.
--
-- Sa décision du 4 septembre 2026 : « fige l'allure sur la facture émise — au
-- moment de l'envoi, comme les chiffres et l'identité. Une facture partie ne
-- change plus d'aspect : mon client doit retrouver en ligne exactement ce qu'il
-- a reçu en PDF, y compris six mois plus tard. Un changement de réglage ne
-- rattrape pas les anciennes, c'est voulu. »
--
-- CE QUE ÇA REFERME. Depuis le 4 septembre, la page que le client ouvre porte
-- l'allure de ses documents — typographie, fond, accent (migration 0063) — au
-- lieu du crème d'Atlas. Mais elle la lisait sur l'ENTREPRISE, donc à l'instant
-- de la consultation : changer son réglage repeignait toutes les pages déjà
-- parties, pendant que les PDF archivés, eux, ne bougeaient pas. Le client
-- ouvrait alors deux pièces d'aspects différents pour une même facture.
--
-- C'est la même règle que le reste de la facture, et elle n'est pas nouvelle :
-- l'identité de l'entreprise, le régime de TVA (0039), les mentions légales
-- (0072) et les montants sont tous figés à l'émission. L'aspect manquait.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POURQUOI LE DÉFAUT S'ÉCRIT ICI EN CLAIR, ALORS QU'IL S'ÉCRIT VIDE SUR
-- `entreprises` — et ce n'est pas une contradiction.
--
-- Sur `entreprises`, ces trois colonnes portent une PRÉFÉRENCE VIVANTE : les
-- laisser vides quand rien n'est choisi est ce qui permet à ses documents de
-- suivre la charte le jour où elle bougerait (voir `mettreAJourEntreprise`).
-- Sur `factures`, elles portent un CONSTAT : voilà de quoi cette pièce avait
-- l'air le jour où elle est partie. Figer, c'est précisément refuser qu'elle
-- suive quoi que ce soit ensuite.
--
-- D'où la convention, et elle est sans ambiguïté :
--
--   les trois NULLES  → facture ANTÉRIEURE à cette migration, son aspect n'a
--                       jamais été relevé. La page retombe alors sur l'allure
--                       vivante de l'entreprise, comme avant ce lot — un repli
--                       qui porte l'historique, à ne pas retirer.
--   les trois ÉCRITES → l'aspect du jour de l'envoi. Elles valent le défaut
--                       (`ALLURE_PAR_DEFAUT`) quand il n'avait rien réglé, et
--                       l'écran le reconnaît par `estLAllureParDefaut` pour
--                       rendre exactement la page d'aujourd'hui, au pixel près.
--
-- Sur sa base, ce repli ne servira jamais : elle ne porte aucune facture. Il
-- existe pour les instances qui en auraient.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS doc_typographie text,
  ADD COLUMN IF NOT EXISTS doc_fond text,
  ADD COLUMN IF NOT EXISTS doc_accent text;

-- Les mêmes bornes que sur `entreprises` : une couleur qui n'en est pas une ne
-- rentre pas dans une pièce comptable. Ceinture et bretelles — `normaliserAllure`
-- filtre déjà, mais une écriture directe en base ne passe pas par lui.
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_doc_fond_ck;
ALTER TABLE factures
  ADD CONSTRAINT factures_doc_fond_ck
  CHECK (doc_fond IS NULL OR doc_fond ~ '^#[0-9a-f]{6}$');

ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_doc_accent_ck;
ALTER TABLE factures
  ADD CONSTRAINT factures_doc_accent_ck
  CHECK (doc_accent IS NULL OR doc_accent ~ '^#[0-9a-f]{6}$');

COMMENT ON COLUMN factures.doc_typographie IS
  'L''allure du jour de l''envoi, figée. Nulle avec ses deux sœurs : facture antérieure à 0074, la page retombe sur l''allure vivante de l''entreprise.';
COMMENT ON COLUMN factures.doc_fond IS
  'Le fond du document, figé à l''émission. Une facture partie ne change plus d''aspect.';
COMMENT ON COLUMN factures.doc_accent IS
  'L''accent du document, figé à l''émission — celui que le client voit sur sa page comme sur son PDF.';
