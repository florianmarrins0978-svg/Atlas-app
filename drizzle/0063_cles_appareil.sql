-- LES CLÉS D'APPAREIL — « Ouvrir avec Face ID », et rien d'autre.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa demande du 23 août 2026 :** « je veux bien que tu me codes le Face ID
-- pour le mot de passe, et bien entendu qu'il faut conserver le mot de passe.
-- L'utilisateur va commencer par créer son compte avec son mot de passe et
-- ensuite il décidera s'il veut ouvrir sa session avec le mot de passe ou le
-- Face ID. »
--
-- Sa réponse à la planche 94, le 24 août : **B** — la porte d'aujourd'hui, plus
-- une ligne au-dessus.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUE CETTE TABLE NE CONTIENT PAS, et c'est le point qui rassure.**
--
-- Aucun visage, aucune empreinte, aucune donnée biométrique. Le téléphone garde
-- tout cela pour lui, dans sa puce sécurisée, et ne le rend jamais — pas même à
-- Apple. Ce qui arrive ici, c'est une **clé publique** : de quoi VÉRIFIER une
-- signature, jamais de quoi en produire une. Volée, elle n'ouvre rien.
--
-- C'est ce que l'écran des Réglages promet à l'artisan (« votre visage ne
-- quitte jamais votre téléphone »), et c'est cette table qui le tient.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Pourquoi PAS de politique d'isolation par entreprise.**
--
-- Comme `users` et `tentatives_connexion`, cette table précède l'entreprise :
-- au moment où l'on vérifie une clé, aucune session n'existe encore — c'est
-- justement ce qu'on est en train d'établir. Il n'y a donc aucun
-- `entreprise_id` à poser, et prétendre le contraire ferait croire à un
-- cloisonnement qui n'existe pas ici (`CLAUDE.md` §4).
--
-- **Ce qui la protège à la place, et qui doit tenir sans RLS :** toute lecture
-- vise un identifiant EXACT — la clé, ou l'utilisateur. Cette table ne se
-- parcourt jamais. Et le lien vers `users` est en `ON DELETE CASCADE` : un
-- compte supprimé n'y laisse pas de clé orpheline qui traînerait sans
-- propriétaire.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Le compteur, et pourquoi il ne peut pas servir de garde-fou seul.**
--
-- Un authentificateur incrémente `compteur` à chaque signature ; le voir
-- reculer trahit une clé copiée. Mais les clés de plateforme d'Apple — celles
-- que le patron va employer — n'en tiennent aucun et rendent toujours `0`.
-- Refuser sur zéro fermerait la porte à tous les iPhone. La règle qui tranche
-- vit dans `src/lib/cle-appareil.ts` (`estRejeu`), éprouvée sans base.

CREATE TABLE IF NOT EXISTS "cles_appareil" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- CASCADE : une clé n'a aucun sens sans son compte.
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  -- L'identifiant que l'authentificateur donne à sa clé, en base64url. UNIQUE
  -- sur toute la table, pas seulement par utilisateur : c'est par lui seul
  -- qu'on retrouve un compte au moment de la connexion, quand personne n'a
  -- encore dit qui il est.
  "identifiant_cle" text NOT NULL UNIQUE,

  -- La clé PUBLIQUE, en base64url. De quoi vérifier une signature, jamais d'en
  -- produire une.
  "cle_publique" text NOT NULL,

  -- Le nombre de signatures annoncé par l'appareil. Zéro est une valeur
  -- ordinaire (voir en-tête).
  "compteur" bigint NOT NULL DEFAULT 0,

  -- « iPhone », « Mac » — deviné du navigateur, renommable, et qui ne décide de
  -- RIEN. Il sert à s'y retrouver dans une liste de deux ou trois lignes.
  "nom_appareil" text NOT NULL,

  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "dernier_usage_le" timestamptz,

  CONSTRAINT "cles_appareil_compteur_positif" CHECK ("compteur" >= 0),
  CONSTRAINT "cles_appareil_nom_non_vide" CHECK (length(btrim("nom_appareil")) > 0)
);

-- Lister les appareils d'un compte, et les compter avant d'en ajouter un.
CREATE INDEX IF NOT EXISTS "cles_appareil_utilisateur_idx"
  ON "cles_appareil" ("utilisateur_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON "cles_appareil" TO atlas_app;

COMMENT ON TABLE "cles_appareil" IS
  'Clés publiques WebAuthn — « Ouvrir avec Face ID ». Aucune donnée biométrique : le visage ne quitte jamais le téléphone (24 août 2026).';
