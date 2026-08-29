-- LE FIL DE L'ASSISTANT SURVIT AU RECHARGEMENT DE LA PAGE.
--
-- Sa demande du 27 août 2026 : « 2 et 3 déjà ». Le 3 était *qu'il se souvienne*
-- — jusqu'ici le fil vivait dans l'état d'un composant React, et disparaissait
-- au premier rechargement. Or son onglet reste ouvert des heures et son banc
-- redémarre plusieurs fois par soirée (`HANDOVER.md`, piège 0) : la question
-- « et celui d'avant ? » ne trouvait plus rien.
--
-- **Un fil PAR UTILISATEUR, pas par entreprise.** Deux associés qui partagent
-- une entreprise ne partagent pas leurs conversations. La RLS, elle, isole les
-- entreprises — c'est `utilisateur_id` qui isole les personnes, et il se filtre
-- dans le dépôt, faute d'un `app.utilisateur_id` posé par `withEntreprise`.
--
-- **Un fil unique, pas un par chantier.** Le chantier est noté sur le message
-- pour la relecture, mais il ne coupe pas le fil : il passe d'un chantier à
-- l'autre en parlant, et une conversation qui repartirait de zéro à chaque
-- écran serait exactement ce qu'il vient de faire retirer.

CREATE TABLE "messages_assistant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Le chantier ouvert au moment où le message a été écrit, s'il y en avait un.
  "chantier_id" uuid,
  "role" text NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "contenu" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- **L'ORDRE DU FIL NE PEUT PAS TENIR À L'HORLOGE.** `now()` rend l'instant de
  -- DÉBUT DE TRANSACTION : la question et sa réponse, écrites ensemble, portent
  -- la même date à la microseconde près. Le classement retombait alors sur
  -- l'identifiant — un UUID tiré au hasard —, et la réponse passait devant la
  -- question une fois sur deux. Vu rouge par `test-fil-assistant.ts`.
  --
  -- Une séquence, elle, ne dépend d'aucune horloge et n'a pas d'ex æquo.
  "rang" bigserial NOT NULL
);

-- L'ordre de lecture est toujours le même : ce fil-ci, du plus récent au plus
-- ancien, puis on retourne. L'index le sert exactement.
CREATE INDEX "messages_assistant_fil_idx"
  ON "messages_assistant" ("entreprise_id", "utilisateur_id", "rang" DESC);

ALTER TABLE "messages_assistant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages_assistant" FORCE ROW LEVEL SECURITY;

CREATE POLICY "messages_assistant_isolation" ON "messages_assistant"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, DELETE ON "messages_assistant" TO atlas_app;
-- La séquence de `rang` s'utilise à chaque insertion : sans ce droit, le rôle
-- bridé ne peut plus écrire une ligne, et l'erreur accuse la table.
GRANT USAGE ON SEQUENCE "messages_assistant_rang_seq" TO atlas_app;
