-- LE MOTIF D'UNE ABSENCE, DIT POUR LE COMPTABLE (sa planche du 5 novembre
-- 2026, validée : `appli/soignee/motif-absence.html`, « très bien »).
--
-- **Pourquoi une colonne de plus, et pas le motif d'aujourd'hui.** Le champ
-- libre `motif` est promis « pour vous » à l'écran (AbsencesEquipe.tsx) : il
-- ne part nulle part, et l'envoyer au comptable trahirait cette phrase. La
-- NATURE est faite pour partir : congé, maladie, sans solde, déplacement,
-- formation, autre. Elle décide aussi si le jour compte TRAVAILLÉ (déplacement
-- et formation, `src/lib/nature-absence.ts`) : une absence d'Atlas est née le
-- 14 août pour une équipe partie en déplacement cinq jours, et ces jours-là
-- sont payés.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne
-- nullable, sans défaut. Aucune ligne existante n'est relue ni écrite : rien à
-- éprouver sur une base habitée, rien à voir sous FORCE RLS. Les absences déjà
-- notées restent SANS nature, et c'est ce qui est vrai : personne ne l'a dite
-- (`docs/AGENT.md` §3, rien ne s'invente). L'écran des jours travaillés
-- demande alors « pourquoi ? ». Un code d'avant servi sur ce schéma l'ignore.

ALTER TABLE "absences_equipe" ADD COLUMN IF NOT EXISTS "nature" text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'absences_equipe_nature_ck') THEN
    ALTER TABLE "absences_equipe" ADD CONSTRAINT "absences_equipe_nature_ck"
      CHECK ("nature" IS NULL OR "nature" IN ('conge', 'maladie', 'sans_solde', 'deplacement', 'formation', 'autre'));
  END IF;
END $$;
