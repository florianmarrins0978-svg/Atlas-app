-- LES SESSIONS FERMÉES — une sortie RÉVOQUE la session, elle ne se contente
-- plus d'effacer son cookie.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **LE DÉFAUT QUE CETTE TABLE FERME (mesuré le 22 octobre 2026).**
--
-- La session d'Atlas est un JWT sans table : se déconnecter effaçait le cookie,
-- et c'était tout. Or chaque réponse qui passe par le middleware REPOSE ce
-- cookie pour prolonger la session. Une réponse partie avant la sortie et
-- revenue après (un préchargement des Réglages, le bandeau du banc) reposait
-- donc le cookie que la sortie venait d'effacer : la session revivait. Le même
-- trou laissait un cookie volé valable après la sortie de son propriétaire.
--
-- Une ligne ici dit : *cette session-là est fermée*. `getCurrentCtx` la lit à
-- chaque requête, à côté de la coupure de « me déconnecter partout », et
-- renvoie le cookie qui la porte vers son effacement.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **PAR SESSION, ET NON PAR COMPTE.** `session_id` est l'identité que le jeton
-- porte (`src/lib/identite-session.ts`) : tirée par le serveur à chaque vraie
-- connexion, chiffrée dans le JWT, inchangée aux réémissions. Fermer celle-ci
-- laisse ouvertes les autres sessions du même compte, et ne touche ni aux clés
-- Face ID ni aux appareils de confiance : c'est ce qui sépare « se
-- déconnecter » de « me déconnecter partout ».
--
-- **Aucune politique d'isolation par entreprise** — même raison que
-- `preuves_authentification` et `cles_appareil` : une session appartient à une
-- PERSONNE. Et la ligne ne porte aucun secret : volée, elle n'ouvre rien.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **`atlas_app` lit et ajoute ; il n'efface ni ne modifie.** Effacer une ligne
-- rouvrirait une session fermée : une injection SQL ne doit pas pouvoir le
-- faire. Pour la même raison, aucune purge : un JWT d'Atlas est RÉÉMIS à chaque
-- requête, donc un cookie qu'on continue de présenter ne meurt jamais de
-- vieillesse, et sa révocation doit lui survivre. Une ligne pèse une centaine
-- d'octets, une par sortie ; le compte supprimé emporte les siennes.
--
-- Expand seul : une table neuve, que l'ancien code ignore, et aucune écriture
-- de données (.claude/rules/deployment-safety.md, .claude/rules/migrations.md).

CREATE TABLE IF NOT EXISTS "sessions_fermees" (
  -- L'identité de la session, telle que le jeton la porte.
  "session_id" text PRIMARY KEY,
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "fermee_le" timestamptz NOT NULL DEFAULT now(),
  -- Une session vide n'est pas une session : sans identité, la ligne
  -- fermerait tout le monde, ou personne.
  CONSTRAINT "sessions_fermees_identite" CHECK (btrim("session_id") <> '')
);

-- La cascade du compte supprimé, et rien d'autre : la lecture passe par la clé.
CREATE INDEX IF NOT EXISTS "sessions_fermees_utilisateur_idx"
  ON "sessions_fermees" ("utilisateur_id");

-- Les privilèges par défaut du schéma accordent tout à `atlas_app` sur une
-- table neuve (0001) : le `GRANT` seul n'aurait rien retiré. Constaté par
-- `test-compte-db`, qui a pu effacer une session fermée avant cette ligne.
REVOKE ALL ON "sessions_fermees" FROM atlas_app;
GRANT SELECT, INSERT ON "sessions_fermees" TO atlas_app;
