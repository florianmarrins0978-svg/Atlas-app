-- Nommer les équipes — et se taire quand il n'y a personne.
--
-- **Le patron, le 2026-08-10 :** *« il faut que dans le fichier réglages on
-- puisse mettre le nom des équipes — soit équipe A équipe B, soit des noms et
-- prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas
-- qu'il y ait quand même écrit équipe A équipe B. »*
--
-- =========================================================================
-- Pourquoi `nom` est NULLABLE, et pourquoi il n'a AUCUNE valeur par défaut
-- =========================================================================
--
-- Un nom absent est un **état normal**, pas une donnée manquante. Le patron
-- travaille peut-être seul, ou avec deux équipes qu'il ne nomme pas : dans les
-- deux cas il n'a rien à écrire, et rien ne doit être écrit à sa place.
--
-- Écrire « Équipe A » en base au moment de l'insertion serait le piège exact
-- qu'il désigne. La lettre deviendrait alors une donnée — indiscernable d'un
-- nom qu'il aurait choisi — et le jour où il passe à une seule équipe, le
-- planning aurait un nom à écrire là où il ne doit rien écrire du tout.
--
-- **Le repli est un affichage, jamais une donnée.** Il vit dans une seule
-- fonction pure (`src/lib/equipes.ts`, `libelleEquipe`), appelée par l'écran
-- comme par la revalidation serveur. Deux implémentations divergeraient, et le
-- jour où elles divergent l'écran promet une équipe que le serveur ne connaît
-- pas.
--
-- C'est le même arbitrage que pour les prix (`docs/AGENT.md` §3) : sans source
-- fiable, on n'écrit pas.
--
-- =========================================================================
-- Qui fait autorité sur le NOMBRE d'équipes
-- =========================================================================
--
-- `entreprises.nombre_equipes` — et cette table ne porte que des NOMS.
--
-- Le compteur existe déjà, il commande la planification
-- (`departPossible`, `jourRetenable`), et il est éprouvé. Lui substituer un
-- `COUNT(*)` sur cette table ferait dépendre le calcul des disponibilités de
-- l'existence de lignes qu'aucun écran n'oblige à créer.
--
-- Conséquence assumée : **une ligne peut exister au-delà du compteur**, et on
-- ne la supprime pas quand il redescend. Quelqu'un qui passe de trois équipes
-- à deux puis revient à trois retrouve le nom qu'il avait écrit pour la
-- troisième. Effacer aurait été une perte silencieuse, sur une donnée saisie à
-- la main que rien ne reconstitue.
--
-- Le `rang` porte la lettre de repli (1 → A, 2 → B… 20 → T) et ne bouge
-- jamais : c'est ce qui garantit qu'« Équipe B » désigne toujours la même
-- équipe d'un écran à l'autre.

CREATE TABLE "equipes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- 1 à 20, comme `entreprises.nombre_equipes`. Le rang décide de la lettre de
  -- repli et de l'ordre d'affichage — jamais l'ordre d'insertion, qui
  -- changerait au gré des saisies.
  "rang" integer NOT NULL CHECK ("rang" >= 1 AND "rang" <= 20),

  -- Le nom écrit par le patron. NULL tant qu'il n'a rien écrit — voir plus
  -- haut : ce n'est pas un trou à combler.
  "nom" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Deux lignes de même rang donneraient deux réponses à « qui est l'équipe
  -- B ? », et le planning en choisirait une au hasard.
  CONSTRAINT "equipes_entreprise_rang_uk" UNIQUE ("entreprise_id", "rang")
);

ALTER TABLE "equipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "equipes_isolation" ON "equipes"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "equipes" TO atlas_app;

-- =========================================================================
-- Quelle équipe tient quel chantier
-- =========================================================================
--
-- NULL veut dire « pas encore attribué », et c'est l'état de tous les
-- chantiers planifiés avant aujourd'hui. Ne rien supposer d'autre est ce qui
-- garantit que cette migration ne prétende pas savoir qui a fait quoi.
--
-- `ON DELETE SET NULL` plutôt que `CASCADE` : supprimer une équipe ne doit
-- jamais emporter le chantier qu'elle tenait. Le chantier redevient simplement
-- non attribué — un état que l'écran sait montrer.
ALTER TABLE "chantiers"
  ADD COLUMN "equipe_id" uuid REFERENCES "equipes"("id") ON DELETE SET NULL;

CREATE INDEX "chantiers_equipe_idx" ON "chantiers" ("entreprise_id", "equipe_id");
