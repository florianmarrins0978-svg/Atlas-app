-- LA MAIN D'ŒUVRE RÉPARTIE SUIT LE DEVIS REPRIS — sa décision du 6 novembre
-- 2026, devant l'image d'une haie reprise par « Dernier devis » :
--
-- *« Il faut garder les 400 € de main d'œuvre. Et quand on fait mettre à jour
-- les prix, ça doit juste se mettre à jour par rapport à la taille de la haie.
-- À part si les prix de la main d'œuvre ont augmenté : si on est passé de 400
-- à 420, ça se réfère au nouveau prix de la main d'œuvre. »*
--
-- Ce qu'il manquait pour le faire :
--
-- · `jours_main_doeuvre` : les jours d'homme que représente la part répartie
--   sur ce travail (`part_main_doeuvre`, migration 0155). La part ne gardait
--   que des euros ; sans les jours, « 400 € à 210 € le jour par homme » ne se
--   calcule pas, il se devinerait. Nuls quand ils ne sont pas connus : une
--   part posée avant cette migration, ou celle d'un partenaire, qui garde
--   alors son montant. Six décimales : 333,33 € à 200 € le jour font 1,66665
--   jour, et l'arrondi ne doit pas déplacer un centime en reprenant ;
-- · `part_ancienne`, `part_grille` : les deux bases de la main d'œuvre d'une
--   ligne reprise, comme `prix_ancien` et `prix_grille` le sont pour son
--   travail (migration 0106). La réponse et la hausse se recalculent toujours
--   depuis elles : rien ne s'empile.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : trois colonnes
-- nullables, sans défaut à recopier. Aucune ligne existante n'est relue ni
-- écrite : rien à éprouver sur une base habitée, rien à voir sous FORCE RLS.
-- Un code d'avant servi sur ce schéma les ignore, et un devis déjà envoyé ne
-- change pas d'un centime.
ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "jours_main_doeuvre" numeric(12, 6);
ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "part_ancienne" numeric(12, 2);
ALTER TABLE "lignes_prix" ADD COLUMN IF NOT EXISTS "part_grille" numeric(12, 2);
