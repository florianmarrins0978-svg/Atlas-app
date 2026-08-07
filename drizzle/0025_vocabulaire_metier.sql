-- Ce qu'Atlas sait du métier, et ce qu'il a appris du patron.
--
-- **Deux tables, et leur séparation est la décision qui compte** (voir
-- `docs/QUESTIONS.md` §10, écrit avec le patron le 7 août 2026).
--
--   `termes_metier`      — le vocabulaire et les règles de chiffrage. Partagés,
--                          parce qu'ils ne contiennent AUCUNE donnée de client :
--                          ni nom, ni adresse, ni prix. Ce sont des mots et des
--                          principes. Ils partent avec l'application chez tous
--                          les futurs clients — décision du patron, le même jour.
--
--   `corrections_dictee` — ce qu'il avait dicté, ce qu'il a finalement écrit.
--                          Rattachées à l'entreprise, isolées comme le reste :
--                          elles sont faites de ses chantiers, de ses libellés
--                          et de ses prix. Celles-là ne se partagent jamais.
--
-- Confondre les deux aurait été la faute grave : verser le vocabulaire dans une
-- entreprise l'aurait rendu inutile aux autres, et verser les corrections dans
-- le partagé aurait exposé les prix d'un artisan à ses concurrents.

-- =========================================================================
-- 1. Le vocabulaire et les règles — partagés, sans donnée de client
-- =========================================================================
--
-- Pas d'`entreprise_id`, donc pas de politique d'isolation : c'est le même
-- choix que `catalogue_prestations` (migration 0007), et pour la même raison.
-- Une table sans donnée personnelle n'a rien à isoler ; lui poser une politique
-- ferait croire à une protection qui ne protège rien.
CREATE TABLE "termes_metier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- « mot » : un terme du métier et ce qu'il désigne.
  -- « regle » : une règle de chiffrage ou de rédaction, énoncée par le patron.
  --
  -- Les deux vivent dans la même table parce qu'ils vont au même endroit — la
  -- consigne envoyée avec chaque dictée — et qu'ils s'y présentent ensemble.
  -- Deux tables auraient imposé deux écrans pour une seule intention.
  "nature" text NOT NULL DEFAULT 'mot' CHECK ("nature" IN ('mot', 'regle')),

  -- Le terme, ou l'énoncé de la règle. « charpentière champignonnée », ou
  -- « chaque ligne doit pouvoir se vendre seule ».
  "intitule" text NOT NULL,

  -- Ce que ça veut dire, en français.
  "definition" text NOT NULL,

  -- **La colonne qui fait le travail.** Une définition explique ; une consigne
  -- dit quoi FAIRE. « C'est une suppression, pas une taille : ligne à part sur
  -- le devis. » Sans elle, le modèle comprend le mot et se trompe quand même de
  -- traitement — c'est exactement ce qui a fait disparaître « on le coupe en 50,
  -- on le fend » du devis du 7 août 2026.
  "consigne" text,

  -- L'ordre d'affichage ET d'envoi : quand la consigne dépasse le budget de
  -- caractères, ce sont les derniers qui tombent. Le patron décide donc
  -- lui-même de ce qui compte le plus, plutôt que de subir un tri arbitraire.
  "ordre" integer NOT NULL DEFAULT 0,

  -- Retirer un terme sans le supprimer : une formulation qu'on essaie, qui ne
  -- donne rien, et qu'on veut pouvoir remettre sans la réécrire.
  "actif" boolean NOT NULL DEFAULT true,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Un même intitulé deux fois, c'est deux consignes contradictoires envoyées
-- ensemble — et un modèle qui tranche au hasard.
CREATE UNIQUE INDEX "termes_metier_intitule_uk" ON "termes_metier" (lower("intitule"));
CREATE INDEX "termes_metier_ordre_idx" ON "termes_metier" ("nature", "ordre");

GRANT SELECT, INSERT, UPDATE, DELETE ON "termes_metier" TO atlas_app;

-- =========================================================================
-- 2. Les corrections du patron — par entreprise, isolées
-- =========================================================================
--
-- **Le manque que ça comble, dans ses mots :** *« comment je fais pour le
-- nourrir et qu'il apprenne de ces erreurs ? »* — le 7 août 2026, devant un
-- devis qui avait tout mis sur une ligne et perdu la fente du bois.
--
-- Une règle énoncée dit QUOI faire ; un exemple réel montre JUSQU'OÙ. Les deux
-- partent ensemble dans la consigne, et c'est leur conjonction qui apprend :
-- « proposé 1 020 € sur une ligne → retenu 850 € + 250 € sur deux lignes »
-- illustre la règle des lignes vendables seules mieux que trois paragraphes.
CREATE TABLE "corrections_dictee" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- Le chantier d'où vient l'observation. Une correction par chantier : le
  -- patron retouche son devis plusieurs fois d'affilée, et compter chaque
  -- passage remplirait la mémoire d'états intermédiaires — exactement le piège
  -- déjà rencontré avec `lecons_prix` (migration 0023).
  "chantier_id" uuid NOT NULL,

  -- Ce qu'il avait dicté, tel que transcrit. C'est le point de départ que le
  -- modèle doit apprendre à lire correctement.
  "dictee" text NOT NULL,

  -- Ce qu'Atlas avait proposé, et ce que le patron a retenu : deux listes de
  -- lignes { libelle, montant }. En JSON parce que leur forme n'a pas à être
  -- interrogée par la base — elles sont relues en bloc, pour être montrées au
  -- modèle telles quelles.
  "propose" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "retenu" jsonb NOT NULL DEFAULT '[]'::jsonb,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "corrections_dictee_chantier_uk" UNIQUE ("chantier_id")
);

CREATE INDEX "corrections_dictee_entreprise_idx" ON "corrections_dictee" ("entreprise_id", "updated_at" DESC);

ALTER TABLE "corrections_dictee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "corrections_dictee" FORCE ROW LEVEL SECURITY;

CREATE POLICY "corrections_dictee_isolation" ON "corrections_dictee"
  USING ("entreprise_id" = current_setting('app.entreprise_id', true)::uuid)
  WITH CHECK ("entreprise_id" = current_setting('app.entreprise_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "corrections_dictee" TO atlas_app;

-- =========================================================================
-- 3. La première règle, celle du patron
-- =========================================================================
--
-- Elle est posée ici plutôt que laissée à saisir : c'est la seule règle de
-- chiffrage qu'il ait énoncée en toutes lettres, elle explique un écart de
-- 150 € sur un devis réel, et elle part avec l'application (sa décision, le
-- 7 août 2026). Un dépôt qui la connaîtrait sans l'appliquer serait un dépôt
-- qui a écouté sans entendre.
INSERT INTO "termes_metier" ("nature", "intitule", "definition", "consigne", "ordre") VALUES
(
  'regle',
  'Chaque ligne doit pouvoir se vendre seule',
  'Une prestation que le client peut refuser, ou confier à un autre artisan, doit porter son propre déplacement et sa propre mise en œuvre — jamais son seul coût marginal. Sinon : le client qui refuse cette prestation trouve le reste trop cher, et celui qui ne garde que celle-là la paie moins qu''elle ne coûte.',
  'Ne jamais ventiler un prix global au prorata du temps passé. Alléger la ligne principale et charger la ligne détachable (la fente, l''évacuation, le dessouchage), de façon que chacune tienne debout seule. Le total reste le même ; c''est la répartition qui protège les deux cas.',
  0
);
