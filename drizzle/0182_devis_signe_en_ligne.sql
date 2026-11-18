-- LE DEVIS SIGNÉ DEPUIS SON LIEN.
--
-- Sa planche du 17 novembre 2026 (`appli/soignee/devis-signe-par-le-client.html`),
-- puis son « les deux me vont, tu peux coder » du 18 : le client signe au doigt
-- avant « J'accepte ce devis », et sa signature se pose dans l'encadré « Bon
-- pour accord » du PDF.
--
--   · `envois_devis.signature_png` : le trait du client, en PNG `data:` (la
--     règle de `src/lib/signature-au-doigt.ts`). NULL sur tout envoi d'avant,
--     sur un refus, une correction, et un accord papier ;
--   · `envois_devis.pdf_signe_cle` : le devis recomposé avec sa signature, à
--     côté de celui parti à l'envoi, qui ne change JAMAIS (`devis.pdf_storage_key`) ;
--   · `acceptations_defaites.signature_png` : quand le patron défait un accord,
--     la signature part avec la copie qui en garde la preuve (migration 0123).
--
-- **EXPAND SEUL** : trois colonnes NULL, aucune ligne lue ni réécrite. Le code
-- d'avant les ignore et tourne tel quel dessus. Aucune contrainte « accepté
-- donc signé » ici : les accords d'avant n'ont pas de signature, et un accord
-- papier n'en aura jamais en base. La règle vit dans `enregistrerReponse`.
--
-- Les droits de `envois_devis` sont posés sur la table (0015) et ceux de
-- `acceptations_defaites` aussi (0123) : ils couvrent ces colonnes.

ALTER TABLE "envois_devis" ADD COLUMN IF NOT EXISTS "signature_png" text;
ALTER TABLE "envois_devis" ADD COLUMN IF NOT EXISTS "pdf_signe_cle" text;
ALTER TABLE "acceptations_defaites" ADD COLUMN IF NOT EXISTS "signature_png" text;
