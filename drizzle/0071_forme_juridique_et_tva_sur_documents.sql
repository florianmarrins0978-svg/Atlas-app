-- **Deux mentions légales promises, jamais imprimées.**
--
-- `entreprises.forme_juridique` et `entreprises.numero_tva` existent depuis la
-- migration 0039, se saisissent depuis l'écran Réglages > Identité, et cet
-- écran promet même : « Votre numéro intracommunautaire figure alors sur la
-- facture ». Elles n'atteignaient pourtant ni le devis ni la facture :
-- `document-commun.ts` ne les recevait pas, faute de colonnes sur `devis` et
-- `factures` pour les figer au jour de l'émission — comme le reste de
-- l'identité (nom, adresse, SIRET, migration 0038).
--
-- Or la forme juridique est une mention obligatoire des documents commerciaux
-- d'une société (Code de commerce, art. R123-237), et le numéro de TVA
-- intracommunautaire l'est sur la facture d'un assujetti (CGI, art. 242
-- nonies A, ann. II).
--
-- Migration ADDITIVE : deux colonnes nullables sur chaque table, sans valeur
-- par défaut différente de NULL. Les devis et factures déjà émis n'en portent
-- aucune trace — ils ressortent identiques à eux-mêmes, ce qu'ils étaient le
-- jour de leur émission.

ALTER TABLE "devis"
  ADD COLUMN IF NOT EXISTS "entreprise_forme_juridique" text,
  ADD COLUMN IF NOT EXISTS "entreprise_numero_tva" text;

ALTER TABLE "factures"
  ADD COLUMN IF NOT EXISTS "entreprise_forme_juridique" text,
  ADD COLUMN IF NOT EXISTS "entreprise_numero_tva" text;
