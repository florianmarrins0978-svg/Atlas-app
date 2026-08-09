-- L'agenda extérieur de l'artisan, s'il choisit d'en relier un.
--
-- **Le patron, le 9 août 2026 :** *« ce qui serait bien, c'est que
-- l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à son
-- agenda Google. »*
--
-- Jusqu'ici, Atlas déduisait les jours libres des seuls chantiers qu'il
-- connaissait. Un rendez-vous noté ailleurs était invisible : Atlas proposait
-- ce jour-là, le client le choisissait, et le doublon se découvrait le matin
-- même — le devis parti, la date acceptée, la promesse faite.
--
-- =========================================================================
-- Pourquoi une table, et pas une variable d'environnement
-- =========================================================================
--
-- C'est ce que sa phrase tranche : *« s'il le souhaite ou non »*. Le
-- raccordement appartient à CHAQUE artisan, jamais à l'installation. Une
-- variable d'environnement vaudrait pour tout le monde à la fois, et il n'y
-- aurait plus de « ou non ».
--
-- La ligne porte donc `entreprise_id` et vit sous la même isolation que le
-- reste. Un artisan qui ne relie rien n'a aucune ligne ici, et garde
-- exactement l'Atlas d'aujourd'hui.
--
-- =========================================================================
-- Ce que cette table ne contient PAS
-- =========================================================================
--
-- Aucun événement, aucun intitulé, aucun participant, aucune heure. Atlas
-- interroge l'agenda au moment où il en a besoin et n'en garde rien : ce qui
-- n'est pas stocké ne peut pas fuir. Un agenda personnel porte les
-- rendez-vous médicaux et les vacances de la famille ; savoir qu'une
-- demi-journée est prise n'exige pas d'en connaître le contenu — même règle
-- qu'à la page du client, qui reçoit des dates et rien d'autre
-- (`docs/AGENT.md` §2.2 bis).
--
-- Les deux jetons, eux, sont **chiffrés avant écriture**
-- (`src/server/agenda/secret-au-repos.ts`). La RLS protège d'un autre artisan,
-- pas d'une sauvegarde recopiée — et un jeton de rafraîchissement ne décrit
-- pas une donnée, il ouvre un compte, durablement.

CREATE TABLE "agendas_externes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- Un seul fournisseur aujourd'hui. La colonne existe pour que le jour où un
  -- artisan tient son agenda ailleurs, la question ne rouvre pas la table.
  "fournisseur" text NOT NULL CHECK ("fournisseur" IN ('google')),

  -- L'adresse du compte relié, affichée à l'artisan pour qu'il sache LEQUEL il
  -- a branché. Sans elle, l'écran dirait « relié » sans dire à quoi, et un
  -- artisan qui a deux comptes Google ne saurait pas s'il s'est trompé.
  "compte" text,

  -- Chiffrés. Voir l'en-tête.
  "jeton_acces" text,
  "jeton_rafraichissement" text,

  -- Quand le jeton d'accès cesse d'être valable. Google les fait expirer en une
  -- heure ; celui de rafraîchissement, lui, dure jusqu'à révocation.
  "expire_at" timestamptz,

  -- **Débrancher sans oublier.** Mettre `actif` à faux suffit à ce qu'Atlas
  -- cesse de lire l'agenda, immédiatement. La suppression de la ligne reste
  -- possible et reste le geste par défaut à l'écran — mais un interrupteur
  -- permet de couper d'abord et de décider ensuite.
  "actif" boolean NOT NULL DEFAULT true,

  -- Quand Atlas a lu cet agenda pour la dernière fois, et si ça s'est mal
  -- passé. Un raccordement qui a cessé de fonctionner — mot de passe changé,
  -- accès révoqué chez Google — doit se voir à l'écran : sinon l'artisan croit
  -- son agenda pris en compte alors qu'Atlas est revenu, en silence, au
  -- comportement qui produisait des doublons.
  "derniere_lecture_at" timestamptz,
  "derniere_erreur" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Un seul agenda par fournisseur et par entreprise : deux lignes Google
  -- feraient deux réponses possibles à « suis-je libre ce jour-là ? ».
  CONSTRAINT "agendas_externes_entreprise_fournisseur_uk"
    UNIQUE ("entreprise_id", "fournisseur")
);

ALTER TABLE "agendas_externes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agendas_externes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "agendas_externes_isolation" ON "agendas_externes"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Pas de politique « par jeton » ici, à la différence des envois : aucun chemin
-- public ne lit cette table. Elle ne s'ouvre que dans une session authentifiée,
-- pour l'entreprise de cette session.

GRANT SELECT, INSERT, UPDATE, DELETE ON "agendas_externes" TO atlas_app;
