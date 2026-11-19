-- LA FICHE DE DIAGNOSTIC DANS SON ORDRE, SOIGNÉE.
--
-- Son ordre du 22 septembre 2026 (« le nom, est-ce grave pour l'arbre,
-- comment ça arrive, comment ça se propage »), puis sa planche du
-- 19 novembre 2026 (`appli/soignee/fiche-de-diagnostic.html`), et son « code
-- la » du même soir.
--
--   · `fiches_phyto.gravite_selon_la_source` : ce que la SOURCE dit de la
--     gravité, en phrases, sous « Est-ce grave pour l'arbre ? ». Sa question :
--     *« Gravité vigilance, ça veut rien dire ? Que dit l'INRAE ? »*. Le
--     niveau `gravite` reste, interne : il pèse sur la mention de stabilité ;
--   · `note_impact`, `note_agressivite`, `note_frequence` : les trois notes
--     sur 3 que donnent les pages forêts de l'INRAE, en barres à l'écran
--     (« laisse juste les trois petits trucs de couleur »). Toutes les trois
--     ou aucune (contrainte ci-dessous) : une jauge sur trois ne se lit pas ;
--   · `comment_ca_arrive`, `quand_ca_se_voit`, `autres_essences` : les trois
--     questions qu'il se pose debout devant l'arbre ;
--   · `taxons.article` : « un », « une », « des ». L'écran écrit « Probable
--     sur un peuplier. » ; le genre d'un nom d'essence ne se devine pas, il
--     s'écrit dans la fiche. Sans article, l'écran n'en invente aucun.
--
-- **EXPAND SEUL** : des colonnes NULL, aucune ligne lue ni réécrite, donc rien
-- que la RLS puisse cacher (`.claude/rules/migrations.md`). Les fiches déjà en
-- base gardent ces colonnes vides : leurs blocs ne s'affichent pas, jusqu'à ce
-- qu'elles les reçoivent de leurs sources, jamais de mémoire. Les droits des
-- deux tables (0056) couvrent les colonnes : `atlas_app` les lit, n'y écrit
-- rien.

ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "gravite_selon_la_source" text;
ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "note_impact" integer;
ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "note_agressivite" integer;
ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "note_frequence" integer;
ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "comment_ca_arrive" text;
ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "quand_ca_se_voit" text;
ALTER TABLE "fiches_phyto" ADD COLUMN IF NOT EXISTS "autres_essences" text;
ALTER TABLE "taxons" ADD COLUMN IF NOT EXISTS "article" text;

-- Les notes se lisent sur 3, et vont ensemble. Vérifiée sur toutes les lignes
-- par PostgreSQL : sur une base habitée, les fiches d'avant ont les trois à
-- NULL, ce que la contrainte accepte.
ALTER TABLE "fiches_phyto" DROP CONSTRAINT IF EXISTS "fiches_phyto_notes_source_ck";
ALTER TABLE "fiches_phyto" ADD CONSTRAINT "fiches_phyto_notes_source_ck" CHECK (
  (note_impact IS NULL AND note_agressivite IS NULL AND note_frequence IS NULL)
  OR (note_impact BETWEEN 1 AND 3 AND note_agressivite BETWEEN 1 AND 3 AND note_frequence BETWEEN 1 AND 3)
);

ALTER TABLE "taxons" DROP CONSTRAINT IF EXISTS "taxons_article_ck";
ALTER TABLE "taxons" ADD CONSTRAINT "taxons_article_ck" CHECK (article IS NULL OR article IN ('un', 'une', 'des'));
