-- File d'attente de purge des audios transcrits (voir docs/RGPD.md §4).
--
-- Pourquoi une file, alors qu'un simple balayage de `notes_vocales` semblerait
-- suffire : cette table est protégée par une politique d'isolation par
-- entreprise, et le planificateur, lui, n'a de contexte d'AUCUNE entreprise.
-- Un balayage direct ne renvoie donc rien — silencieusement. La purge aurait
-- paru fonctionner sans jamais rien purger, et l'écart de conservation serait
-- resté ouvert en croyant l'avoir refermé.
--
-- Deux réponses étaient possibles : affaiblir l'isolation pour laisser passer
-- la maintenance, ou lui donner sa propre file. La seconde est retenue :
-- l'isolation reste entière, et la file porte l'entreprise concernée, ce qui
-- permet au planificateur d'adopter le contexte de chacune à son tour — un
-- contexte venu du serveur, jamais d'une entrée d'utilisateur.
--
-- Même principe que `fichiers_a_purger`, déjà en place : une file de
-- maintenance ne porte pas de donnée personnelle et n'a donc pas à être
-- cloisonnée.

CREATE TABLE "audios_a_purger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" uuid NOT NULL REFERENCES "notes_vocales"("id") ON DELETE CASCADE,
  -- Permet au planificateur de se placer dans le contexte de l'entreprise
  -- avant d'écrire dans notes_vocales, sans jamais contourner l'isolation.
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  -- Échéance : l'audio reste disponible jusque-là, pour qu'une transcription
  -- contestée puisse être reprise depuis sa source.
  "purger_le" timestamptz NOT NULL,
  "mis_en_file_le" timestamptz NOT NULL DEFAULT now(),
  -- Une note n'a qu'un audio : deux entrées signifieraient qu'on a perdu le
  -- fil de ce qui a déjà été programmé.
  CONSTRAINT "audios_a_purger_note_uk" UNIQUE ("note_id")
);

CREATE INDEX "audios_a_purger_echeance_idx" ON "audios_a_purger" ("purger_le");

GRANT SELECT, INSERT, UPDATE, DELETE ON "audios_a_purger" TO atlas_app;
