-- LA PREUVE RÉCENTE — ce qui autorise un geste vraiment sensible (M11).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **LA PROPRIÉTÉ TENUE :**
--
--   > Une session ordinaire permet de travailler. Un geste qui engage l'argent
--   > ou l'accès au compte exige une authentification récente, faite DEPUIS
--   > CETTE SESSION — jamais depuis une autre.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI LA CLÉ PRIMAIRE PORTE LA SESSION, ET PAS SEULEMENT L'UTILISATEUR.**
--
-- Une date unique par personne se partagerait entre ses appareils : le patron se
-- ré-authentifie sur son iPhone, et **une session volée sur un autre ordinateur
-- en profiterait dans la seconde**. La preuve est donc attachée au `session_id`
-- que le jeton porte (`src/lib/identite-session.ts`), lequel :
--
--   * est tiré par le serveur à chaque authentification réelle ;
--   * vit dans le JWT chiffré — le navigateur ne peut ni le lire ni le choisir ;
--   * ne change PAS quand Auth.js réémet le jeton, donc une preuve ne s'évapore
--     pas au milieu de sa fenêtre pour une raison technique.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUE CETTE TABLE NE CONTIENT PAS.** Ni mot de passe, ni condensat, ni
-- assertion WebAuthn, ni aucun secret. Une ligne dit seulement : *cette
-- session-là a prouvé son identité à cet instant-là, par ce moyen-là*. Volée,
-- elle n'ouvre rien.
--
-- **Pourquoi aucune politique d'isolation par entreprise** — même raison que
-- `cles_appareil` : une preuve appartient à une PERSONNE, qui peut demain
-- travailler pour deux entreprises. L'isolation tient au fait que chaque requête
-- porte `utilisateur_id`, jamais autre chose.

CREATE TABLE IF NOT EXISTS "preuves_authentification" (
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- L'identité de la session, telle que le jeton la porte.
  "session_id" text NOT NULL,
  "prouve_le" timestamptz NOT NULL DEFAULT now(),
  -- « mot-de-passe » ou « cle-appareil » : sert le journal et l'écran, jamais
  -- la décision — les deux moyens valent une authentification réelle.
  "methode" text NOT NULL,
  -- Une seule preuve par session : se ré-authentifier RAFRAÎCHIT la sienne au
  -- lieu d'empiler des lignes que rien ne nettoierait.
  PRIMARY KEY ("utilisateur_id", "session_id")
);

-- Le ménage : une preuve périmée n'a plus aucune valeur, et la fenêtre se compte
-- en minutes. L'index sert la purge, pas la lecture — celle-ci passe par la clé.
CREATE INDEX IF NOT EXISTS "preuves_authentification_prouve_le_idx"
  ON "preuves_authentification" ("prouve_le");

GRANT SELECT, INSERT, UPDATE, DELETE ON "preuves_authentification" TO atlas_app;
