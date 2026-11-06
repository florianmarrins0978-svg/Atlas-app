-- UNE NOTE NE S'ENREGISTRE QU'UNE FOIS, MÊME ENVOYÉE DEUX FOIS (6 novembre 2026).
--
-- Sa planche du 5 novembre, réponse B le 6 (`appli/soignee/note-sans-reseau.html`) :
-- une note dictée sans réseau est gardée sur le téléphone, et repart sur son
-- appui. Une réponse perdue en chemin, puis un second appui, et le même son
-- arrivait deux fois : la note était réécrite, sa transcription remise à zéro,
-- et le devis se préparait une seconde fois. Le téléphone pose désormais un
-- identifiant sur chaque envoi ; un envoi déjà reçu rend ce qu'il avait rendu
-- (`src/server/services/note-vocale-entrante.ts`, `noteDejaRecue`).
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une colonne nullable,
-- sans défaut. Aucune ligne existante n'est relue ni écrite : rien à éprouver
-- sur une base habitée, rien à voir sous FORCE RLS. Un code d'avant servi sur
-- ce schéma l'ignore ; une note d'avant n'a pas d'identifiant, et un téléphone
-- d'avant n'en envoie pas : elle passe comme hier.

ALTER TABLE "notes_vocales" ADD COLUMN IF NOT EXISTS "envoi_id" uuid;
