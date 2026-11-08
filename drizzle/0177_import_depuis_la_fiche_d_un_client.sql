-- UN IMPORT OUVERT DEPUIS LA FICHE D'UN CLIENT — sa demande du 8 novembre 2026,
-- planche `appli/client-importer-depuis-sa-fiche.html` : *« j'avais juste un
-- devis à importer pour Bernard : est-ce que je peux, à partir de Bernard,
-- cliquer sur importer un devis ? »*.
--
-- L'envoi retient le client depuis lequel il a été ouvert : tout ce qu'il
-- apporte se range chez lui, sans chercher le nom lu
-- (`lignesPourLeClient`, `src/lib/import-tableau.ts`). Le retenir dans la base
-- et non dans l'adresse de l'écran, parce qu'un envoi se reprend : fermé
-- pendant la lecture, il se rouvre depuis Vos clients, et doit encore savoir
-- chez qui ranger.
--
-- **Étendre seulement** (`.claude/rules/deployment-safety.md`) : une colonne
-- facultative, aucune ligne réécrite, aucune contrainte sur l'existant. Un
-- envoi d'avant reste un envoi de Vos clients (`NULL`), et l'ancien code
-- l'ignore.
--
-- Le client s'efface : l'envoi redevient un envoi de Vos clients, ses pièces
-- se rangent alors par leur nom, comme avant.

ALTER TABLE "envois_pieces" ADD COLUMN IF NOT EXISTS "client_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'envois_pieces_client_fk') THEN
    ALTER TABLE "envois_pieces" ADD CONSTRAINT "envois_pieces_client_fk" FOREIGN KEY ("client_id", "entreprise_id")
      REFERENCES "clients"("id", "entreprise_id") ON DELETE SET NULL ("client_id");
  END IF;
END $$;

COMMENT ON COLUMN "envois_pieces"."client_id" IS 'Le client depuis la fiche duquel l''import a été ouvert : ses pièces se rangent chez lui (8 novembre 2026).';
