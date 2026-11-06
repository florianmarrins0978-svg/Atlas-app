-- HIVERNER L'ARROSAGE (sa planche du 5 novembre 2026, sa réponse « la B » du
-- 6 novembre : `appli/soignee/hiverner-l-arrosage.html`).
--
-- Sa demande, mot pour mot : « Tous les clients où on a facturé un arrosage
-- automatique, il faudrait mettre une petite pastille à côté du nom […] à
-- partir de début novembre […] ça nous éviterait de les oublier. » Puis, le
-- 6 novembre : « pour les contrats d'entretien, souvent, on fait l'hivernage.
-- Atlas demande s'il y a un arrosage automatique et si on fait l'hivernage. »
--
-- **Trois faits sur le client, posés par LUI, jamais devinés.** Une ligne de
-- facture n'est qu'un texte : « arrosage de reprise » sur une plantation n'est
-- pas un réseau, et « 9 turbines » en est un sans le mot. Atlas DEMANDE (sur la
-- fiche du client) ; NULL veut dire « jamais demandé », et c'est ce qui fait
-- paraître la question.
--   arrosage_automatique : le client a-t-il un arrosage automatique ;
--   hivernage_par_nous   : l'hivernage, est-ce nous qui le faisons ;
--   hiverne_le           : le jour où l'hivernage a été fait, pour la saison.
--
-- **Une marque sur le chantier, jamais la lecture de son libellé** :
-- `chantiers.nature = 'hivernage'` dit au planning et à la fiche qu'un chantier
-- posé est un hivernage. Le libellé « Hivernage de l'arrosage » se réécrit à la
-- main ; la marque, elle, ne se tape pas.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : quatre colonnes
-- nullables, une contrainte sur la seule valeur permise. Aucune ligne existante
-- n'est relue ni écrite : rien à éprouver sur une base habitée, rien à voir
-- sous FORCE RLS. Un code d'avant servi sur ce schéma les ignore.

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "arrosage_automatique" boolean;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "hivernage_par_nous" boolean;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "hiverne_le" date;

ALTER TABLE "chantiers" ADD COLUMN IF NOT EXISTS "nature" text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chantiers_nature_connue') THEN
    ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_nature_connue" CHECK ("nature" IS NULL OR "nature" = 'hivernage');
  END IF;
END $$;
