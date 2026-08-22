-- ═══════════════════════════════════════════════════════════════════════════
-- Le diagnostic végétal, durci : l'hôte d'abord, et l'intégrité prouvée
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Sa consigne du 20 août 2026**, et elle tient en une phrase :
--
--   > *« Mieux vaut refuser de conclure que produire un faux diagnostic. »*
--   > *« Aucune interprétation silencieuse. Aucune donnée inventée. Aucune
--   >   perte d'information. Aucun diagnostic forcé. En cas de doute, bloquer
--   >   plutôt que deviner. »*
--
-- Le module respectait déjà l'essentiel : le modèle n'a aucun champ pour nommer
-- une maladie, tout ce qui s'affiche sort d'une colonne, et l'outil sait
-- refuser. Cette migration ajoute ce qui manquait, et rien d'autre.
--
-- ── 1. Ce qu'une fiche peut désormais porter ───────────────────────────────
--
-- Cinq champs qu'il a nommés, et qui n'existaient nulle part. Chacun est un
-- TABLEAU DE PHRASES recopiées de la source, jamais un texte reformulé : c'est
-- ce qui permet de les comparer champ par champ après l'import.
--
--   critères discriminants · critères d'exclusion · facteurs favorisants
--   informations requises  · méthode de confirmation
--
-- Plus un sixième, qui est un verrou : `certitude_max`. Une fiche dont la
-- source exige un laboratoire ne pourra JAMAIS afficher mieux que ce qu'elle
-- déclare ici, quel que soit le score du rapprochement.
--
-- ── 2. Pourquoi `hotes_non_exhaustifs` ─────────────────────────────────────
--
-- Il demande : *« ne comparer qu'aux maladies compatibles avec l'hôte »*. Le
-- moteur écartait jusqu'ici les seules fiches à hôte `strict`, et se contentait
-- d'un malus ailleurs — parce qu'une liste d'hôtes de source est rarement
-- exhaustive, et qu'exclure sur une liste incomplète fait rater un diagnostic
-- juste, en silence.
--
-- **La sortie n'est pas de choisir entre les deux, c'est de le DEMANDER à la
-- source.** L'exclusion devient la règle ; une fiche dont la source dit
-- elle-même que sa liste n'est pas close (l'anthracnose du chêne : *« de
-- nombreuses espèces »*) le déclare, et retrouve le malus. Le comportement
-- suit alors ce que le document affirme, au lieu d'un arbitrage pris ici.
--
-- ── 3. Le contrôle d'intégrité, et pourquoi il est en CONTRAINTE ───────────
--
--   > *« une fiche ne passe au statut VALIDÉE qu'après réussite de ce
--   >   contrôle. »*
--
-- Écrit dans le seul code de l'import, ce serait une intention. La contrainte
-- `fiches_phyto_integrite_ck` en fait une impossibilité : aucune écriture, par
-- aucun chemin, ne peut poser `validee` sans que la comparaison champ par champ
-- ait réussi dans la même transaction. C'est la même logique que la contrainte
-- qui borne les compléments à un seul (migration 0056) — un invariant que le
-- code ne peut pas oublier.

ALTER TABLE "fiches_phyto"
  -- Ce qui permet de RECONNAÎTRE ce problème plutôt qu'un autre. Recopié.
  ADD COLUMN IF NOT EXISTS "criteres_discriminants" text[] NOT NULL DEFAULT '{}'::text[],

  -- Ce qui l'ÉCARTE. Une source qui dit « jamais sur résineux » ou « les taches
  -- ne dépassent pas la nervure » donne un critère négatif, et un critère
  -- négatif vaut souvent mieux qu'un positif : il ferme au lieu d'ouvrir.
  ADD COLUMN IF NOT EXISTS "criteres_exclusion" text[] NOT NULL DEFAULT '{}'::text[],

  -- « printemps froids et humides », « stress hydrique ». Ne sert pas au score
  -- — ce serait interpréter — mais s'affiche : c'est ce qui aide un paysagiste
  -- à comprendre pourquoi c'est arrivé chez ce client-là.
  ADD COLUMN IF NOT EXISTS "facteurs_favorisants" text[] NOT NULL DEFAULT '{}'::text[],

  -- Ce qu'il faudrait EN PLUS de la photo pour aller plus loin. Affiché tel
  -- quel quand Atlas refuse de conclure : un refus qui dit ce qui manque vaut
  -- dix fois un refus qui se tait.
  ADD COLUMN IF NOT EXISTS "informations_requises" text[] NOT NULL DEFAULT '{}'::text[],

  -- « La détection du champignon en laboratoire est nécessaire pour confirmer
  -- avec certitude le diagnostic. » Quand ce champ est rempli, l'écran le dit,
  -- et le mot « confirmé » n'apparaît nulle part.
  ADD COLUMN IF NOT EXISTS "methode_confirmation" text,

  -- Le plafond de confiance que la SOURCE autorise. Le moteur ne peut jamais
  -- le dépasser, quel que soit son score.
  ADD COLUMN IF NOT EXISTS "certitude_max" text NOT NULL DEFAULT 'elevee',

  -- La source dit-elle elle-même que sa liste d'hôtes n'est pas close ?
  ADD COLUMN IF NOT EXISTS "hotes_non_exhaustifs" boolean NOT NULL DEFAULT false,

  -- Posé par la comparaison champ par champ, dans la transaction d'import.
  ADD COLUMN IF NOT EXISTS "controle_integrite_ok" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "controle_integrite_le" timestamptz;

-- **Les fiches déjà en base repartent à zéro sur ce point, et c'est voulu.**
-- Aucune n'a subi la comparaison champ par champ, puisqu'elle n'existait pas.
-- Les laisser `validee` sans contrôle serait exactement l'inverse de ce qu'il
-- demande. Elles redeviennent `en_revue` et le prochain import les repasse au
-- vert — l'import est idempotent, et les fichiers sources sont dans le dépôt.
UPDATE "fiches_phyto"
   SET "niveau_validation" = 'en_revue'
 WHERE "niveau_validation" = 'validee'
   AND "controle_integrite_ok" = false;

ALTER TABLE "fiches_phyto"
  ADD CONSTRAINT "fiches_phyto_certitude_max_ck"
    CHECK ("certitude_max" IN ('elevee', 'probable', 'incertaine')),

  -- **L'invariant qui porte tout le §2 de sa consigne.**
  ADD CONSTRAINT "fiches_phyto_integrite_ck"
    CHECK ("niveau_validation" <> 'validee' OR "controle_integrite_ok"),

  -- Un contrôle réussi porte sa date. Sans elle on ne saurait pas si le vert
  -- date de la fiche actuelle ou d'une version d'il y a six mois.
  ADD CONSTRAINT "fiches_phyto_integrite_date_ck"
    CHECK ("controle_integrite_ok" = false OR "controle_integrite_le" IS NOT NULL);

COMMENT ON COLUMN "fiches_phyto"."certitude_max" IS
  'Plafond de confiance autorisé par la source. Le moteur ne le dépasse jamais.';
COMMENT ON COLUMN "fiches_phyto"."controle_integrite_ok" IS
  'Posé par la comparaison champ par champ entre le fichier source et la base, dans la transaction d''import. Sans lui, « validee » est refusé par contrainte.';
COMMENT ON COLUMN "fiches_phyto"."hotes_non_exhaustifs" IS
  'La SOURCE déclare que sa liste d''hôtes n''est pas close. Un hôte hors liste devient alors un doute au lieu d''une exclusion.';

-- ── 4. `images_phyto.fichier` : ce que la base PERDAIT ─────────────────────
--
-- **Trouvé en écrivant le contrôle d'intégrité, et c'est exactement ce qu'il
-- est là pour trouver.** Une fiche déclare `fichier` — le chemin de la photo
-- dans le dépôt — et l'import en tirait une clé de stockage, puis JETAIT le
-- chemin. Personne ne s'en était aperçu : rien n'échouait, l'écran affichait
-- bien la photo. Mais l'information « cette image vient de
-- `donnees/phyto/images/anthracnose-platane-feuille.jpg` » n'existait plus
-- nulle part en base, et il devenait impossible de savoir, depuis la base, ce
-- qu'une clé de stockage représentait.
--
-- Sa règle est littérale : *« vérifie qu'aucune information n'a été perdue »*.
-- On garde donc le chemin plutôt que d'écarter le champ du contrôle — écarter
-- aurait été le rendre muet sur sa première vraie prise.
ALTER TABLE "images_phyto"
  ADD COLUMN IF NOT EXISTS "fichier" text;

COMMENT ON COLUMN "images_phyto"."fichier" IS
  'Le chemin de la photo dans le dépôt, tel que la fiche le déclare. `storage_key` en est DÉRIVÉE à l''import et change à chaque réécriture ; celui-ci ne bouge pas.';

-- ── 5. L'ORDRE des listes, que la base perdait aussi ───────────────────────
--
-- **Deuxième prise du contrôle d'intégrité, dans la minute qui a suivi la
-- première.** Les symptômes et les images portaient un `ordre` ; les hôtes, les
-- sources et les confusions non. Ils étaient relus par ordre alphabétique de
-- code, c'est-à-dire dans un ordre qui n'est celui d'aucun document.
--
-- Sa consigne dit, mot pour mot : *« vérifie qu'aucune information n'a été
-- perdue, modifiée, DÉPLACÉE ou interprétée différemment »*. L'ordre d'une
-- liste d'hôtes est une information : la plaquette du DSF nomme d'abord les
-- essences les plus touchées, et c'est ce qu'un paysagiste lit en premier.
--
-- On garde donc l'ordre du fichier, plutôt que de rendre le contrôle tolérant à
-- l'ordre. Un contrôle qu'on assouplit pour qu'il passe ne contrôle plus rien.
ALTER TABLE "hotes_phyto"       ADD COLUMN IF NOT EXISTS "ordre" integer NOT NULL DEFAULT 0;
ALTER TABLE "fiches_sources"    ADD COLUMN IF NOT EXISTS "ordre" integer NOT NULL DEFAULT 0;
ALTER TABLE "confusions_phyto"  ADD COLUMN IF NOT EXISTS "ordre" integer NOT NULL DEFAULT 0;
