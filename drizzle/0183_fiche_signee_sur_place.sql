-- LA FICHE D'ENTRETIEN SIGNÉE SUR PLACE.
--
-- Sa demande du 17 novembre 2026, qui revient sur sa décision du 16 août (pas
-- de signature sur les rapports) : *« si le client est là, ils lui font
-- signer ; s'il n'est pas là, ils ne lui font pas signer. Il ne faut pas que
-- ça soit obligatoire pour enregistrer la fiche »*. Sa planche
-- (`appli/soignee/fiche-signee-par-le-client.html`), puis « tu peux coder » le
-- 18.
--
--   · `signature_png` : le trait du client, en PNG `data:` (la règle de
--     `src/lib/signature-au-doigt.ts`) ;
--   · `signataire` : son nom tel qu'il s'imprime, figé à la signature comme
--     `client_nom_fige` l'est à l'envoi ;
--   · `signee_le` : quand. Les trois vont ensemble, ou aucun.
--
-- **EXPAND SEUL** : trois colonnes NULL, aucune ligne lue ni réécrite. Une
-- fiche sans signature reste ce qu'elle était : c'est le cas ordinaire, le
-- client est au travail pendant qu'on tond. Les droits de la table (0055)
-- couvrent ces colonnes ; la contrainte « tout ou rien » ne vise que des
-- valeurs NULL partout aujourd'hui, elle se vérifie donc sans rien refuser.

ALTER TABLE "passages_entretien" ADD COLUMN IF NOT EXISTS "signature_png" text;
ALTER TABLE "passages_entretien" ADD COLUMN IF NOT EXISTS "signataire" text;
ALTER TABLE "passages_entretien" ADD COLUMN IF NOT EXISTS "signee_le" timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'passages_entretien_signature_entiere') THEN
    ALTER TABLE "passages_entretien" ADD CONSTRAINT "passages_entretien_signature_entiere" CHECK (
      ("signature_png" IS NULL AND "signataire" IS NULL AND "signee_le" IS NULL)
      OR ("signature_png" IS NOT NULL AND "signataire" IS NOT NULL AND "signee_le" IS NOT NULL)
    );
  END IF;
END $$;
