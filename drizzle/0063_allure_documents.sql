-- L'ALLURE DE SES DOCUMENTS — typographie, fond de page, accent, logo
--
-- Sa demande du 23 août 2026 : « il faudrait que l'utilisateur puisse avoir un
-- endroit dédié à la modification de son devis. S'il veut rajouter son logo,
-- changer la typographie, changer le fond de page. »
--
-- **NULL veut dire « comme aujourd'hui »**, et c'est sa règle mot pour mot :
-- « les réglages actuels doivent être par défaut ». Écrire ici le crème et l'or
-- à la création d'une entreprise les figerait sur la valeur du jour ; une
-- correction ultérieure de la charte ne l'atteindrait plus.
--
-- **Sur le DEVIS et la FACTURE seulement** — sa décision du même jour. La
-- feuille de chantier est interne, le compte rendu d'entretien est une page
-- web : ni l'une ni l'autre n'est concernée, et rien ici ne les touche.
--
-- Le logo suit le chemin des photos : l'objet vit dans le stockage, la base ne
-- garde que sa clef et son type. Un `bytea` en base ferait grossir chaque
-- lecture de l'entreprise — elle est lue à chaque écran.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS doc_typographie text,
  ADD COLUMN IF NOT EXISTS doc_fond text,
  ADD COLUMN IF NOT EXISTS doc_accent text,
  ADD COLUMN IF NOT EXISTS logo_storage_key text,
  ADD COLUMN IF NOT EXISTS logo_mime text;

-- Une couleur mal écrite ne doit pas pouvoir entrer : le PDF la lirait et
-- peindrait n'importe quoi. La forme est celle que rend un nuancier.
ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_doc_fond_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_fond_forme
  CHECK (doc_fond IS NULL OR doc_fond ~ '^#[0-9a-f]{6}$');

ALTER TABLE entreprises DROP CONSTRAINT IF EXISTS entreprises_doc_accent_forme;
ALTER TABLE entreprises
  ADD CONSTRAINT entreprises_doc_accent_forme
  CHECK (doc_accent IS NULL OR doc_accent ~ '^#[0-9a-f]{6}$');

COMMENT ON COLUMN entreprises.doc_typographie IS
  'La clef d''une des dix (src/lib/allure-documents.ts). NULL = celle de l''appareil, son réglage d''aujourd''hui.';
COMMENT ON COLUMN entreprises.doc_fond IS
  'Le fond du devis et de la facture, #rrggbb. NULL = le crème d''aujourd''hui.';
COMMENT ON COLUMN entreprises.logo_storage_key IS
  'La clef de son logo dans le stockage. NULL = aucun logo, et le document commence par le nom de l''entreprise, comme avant.';
