-- LES ZONES DE DÉPLACEMENT DE L'ENTREPRISE (ses demandes des 5 et 6 novembre
-- 2026 : `appli/soignee/zones-deplacement.html`).
--
-- Un seul réglage par entreprise, lu par `reglageLu`
-- (`src/lib/zones-deplacement.ts`) : la convention (aucune, paysage,
-- bâtiment), ses zones (un nom qui se change, une borne en km), la teinte du
-- dégradé, et le siège situé d'où les zones partent.
--
-- **NULL veut dire « jamais réglé »**, et c'est un état à part : Jours
-- travaillés invite alors à le régler, une seule fois. « Pas de zones »
-- choisi s'écrit, et l'invitation ne revient plus.
--
-- **EXPAND SEUL** : une colonne nullable, sans défaut. Aucune ligne existante
-- n'est relue ni écrite ; un code d'avant l'ignore.

ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "zones_deplacement" jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entreprises_zones_deplacement_ck') THEN
    ALTER TABLE "entreprises" ADD CONSTRAINT "entreprises_zones_deplacement_ck"
      CHECK ("zones_deplacement" IS NULL OR jsonb_typeof("zones_deplacement") = 'object');
  END IF;
END $$;
