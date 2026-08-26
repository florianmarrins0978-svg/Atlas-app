-- LE FORMAT DU NUMÉRO, ET L'ANNÉE DU COMPTEUR
--
-- Sa demande du 26 août 2026 : « dans la catégorie facture il faut rajouter le
-- format de numéro ». Ses trois décisions, devant `appli/format-de-numero.html` :
-- six chiffres, le « F » des factures gardé, et le compteur qui repart à 1 au
-- 1er janvier.
--
-- **CE QUI ÉTAIT CASSÉ ET QUE PERSONNE N'AVAIT VU :** le millésime était écrit
-- en dur dans le code — « 2026- » pour les devis, « F2026- » pour les factures.
-- En janvier 2027, ses factures auraient encore dit 2026. Un défaut à
-- retardement : le code est juste tant qu'on est en 2026, et aucune suite ne le
-- voit puisqu'elles tournent aujourd'hui.
ALTER TABLE entreprises
  ADD COLUMN IF NOT EXISTS format_numero text;

COMMENT ON COLUMN entreprises.format_numero IS
  'Une clef de FORMATS_NUMERO (src/lib/numero-documents.ts). NULL = le format par défaut.';

-- **L'ANNÉE DU COMPTEUR, et c'est elle qui permet de repartir à 1.**
--
-- Sans elle, rien ne dit si le dernier numéro attribué appartient à cette année
-- ou à la précédente : on ne saurait pas s'il faut continuer ou recommencer.
-- Deux suites distinctes, donc deux années : un devis peut partir en décembre et
-- la facture en janvier.
--
-- NULL sur les lignes existantes = « on ne sait pas de quand date ce compteur ».
-- Le rattrapage juste en dessous la pose à l'année en cours : les numéros déjà
-- attribués sont de 2026, c'est ce que le code écrivait en dur.
ALTER TABLE entreprise_compteurs
  ADD COLUMN IF NOT EXISTS annee_devis integer,
  ADD COLUMN IF NOT EXISTS annee_facture integer;

UPDATE entreprise_compteurs
   SET annee_devis = COALESCE(annee_devis, 2026),
       annee_facture = COALESCE(annee_facture, 2026);

ALTER TABLE entreprise_compteurs
  ALTER COLUMN annee_devis SET DEFAULT EXTRACT(YEAR FROM now())::int,
  ALTER COLUMN annee_facture SET DEFAULT EXTRACT(YEAR FROM now())::int;

COMMENT ON COLUMN entreprise_compteurs.annee_devis IS
  'L''année à laquelle prochain_numero_devis se rapporte. Différente de l''année en cours : le compteur repart à 1.';
