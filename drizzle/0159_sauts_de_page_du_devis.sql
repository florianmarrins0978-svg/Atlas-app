-- LES SAUTS DE PAGE DU DEVIS (sa planche du 3 novembre 2026, codée le 4 :
-- `appli/soignee/devis-mise-en-page.html`, « Nouvelle page ici »).
--
-- **Un saut se pose DEVANT un élément, jamais à une hauteur** : `ligne:<id>`,
-- `totaux`, `notes`, `modalites`. Des lignes ajoutées au-dessus ne le
-- déplacent pas ; c'est ce qu'il a vu sur la planche, et ce que dit sa note
-- « le saut reste devant la ligne choisie ».
--
-- **La ligne se désigne par la ligne de prix du chantier**, pas par la ligne
-- du devis : celle-ci est réécrite à chaque modification d'un brouillon
-- (`getOuCreerDevisBrouillon` efface et recopie), son identifiant change donc
-- à chaque fois. La ligne de prix, elle, reste la même d'une version à
-- l'autre. D'où `lignes_devis.ligne_prix_id`, recopié à chaque écriture.
-- Sans clé étrangère, et c'est voulu : un devis envoyé garde ses lignes même
-- quand la ligne de prix du chantier disparaît ensuite.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : deux colonnes, l'une
-- à défaut constant (`[]`), l'autre nullable. Aucune ligne existante n'est
-- relue ni écrite : rien à éprouver sur une base habitée, rien à voir sous
-- FORCE RLS. Un code d'avant servi sur ce schéma les ignore. Un devis déjà
-- envoyé n'a aucun saut, et son PDF enregistré ne change pas.

ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "sauts_de_page" jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_sauts_de_page_liste') THEN
    ALTER TABLE "devis" ADD CONSTRAINT "devis_sauts_de_page_liste" CHECK (jsonb_typeof("sauts_de_page") = 'array');
  END IF;
END $$;

ALTER TABLE "lignes_devis" ADD COLUMN IF NOT EXISTS "ligne_prix_id" uuid;
