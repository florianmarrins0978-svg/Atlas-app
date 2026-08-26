-- QUATRE RÔLES, ET UNE PORTÉE DE PLANNING QUI SE RÈGLE PERSONNE PAR PERSONNE.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **D'où vient cette table.** `docs/QUESTIONS.md` §10, tranché le 13 août 2026
-- puis précisé le 23 : le patron donne un accès à ses salariés et à ses
-- commerciaux, chacun avec son compte et sa session, et c'est le RÔLE qui décide
-- de ce qu'il atteint. Jusqu'ici la base ne connaissait que `proprietaire` et
-- `membre`, et `membre` ne restreignait rien : un compte non propriétaire
-- atteignait tous les écrans sauf les quelques-uns qui avaient reçu une garde
-- écrite à la main.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **`membre` DEVIENT `salarie`, et ne survit pas.** Le rôle le plus fermé, pas
-- le plus ouvert : une reprise qui laisserait un compte existant plus large
-- qu'avant serait exactement la faute que ce lot répare. Et `CLAUDE.md` §4 bis
-- interdit qu'une valeur provisoire dorme dans les données une fois que la vraie
-- est connue — deux façons de nommer le même rôle finiraient par diverger.
--
-- **La contrainte CHECK n'existait pas**, et c'est pourquoi elle est posée ici :
-- l'énumération vivait dans TypeScript seul (`text("role", {enum: […]})` ne
-- produit aucune contrainte en base). Un rôle mal orthographié par une future
-- migration passait donc sans un mot, et `cheminAutorise` l'aurait traité comme
-- inconnu — c'est-à-dire, dans le meilleur des cas, comme un refus muet.

UPDATE "membres_entreprise" SET "role" = 'salarie' WHERE "role" = 'membre';

ALTER TABLE "membres_entreprise" ALTER COLUMN "role" SET DEFAULT 'salarie';

ALTER TABLE "membres_entreprise"
  ADD CONSTRAINT "membres_entreprise_role_connu"
  CHECK ("role" IN ('proprietaire', 'commercial', 'salarie'));

-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QU'IL VOIT DU PLANNING — un réglage par PERSONNE, pas par rôle.**
--
-- Sa réponse du 13 août 2026 : *« Accès à tout, mais le patron choisira s'il a
-- accès qu'à ses chantiers ou à tout. »* Deux salariés peuvent donc ne pas voir
-- le même planning, et cela ne se déduit d'aucun rôle.
--
-- **Le défaut est « tout », et c'est sa décision** : restreindre est un geste,
-- pas un état de départ. Un salarié invité ce matin voit le planning entier tant
-- que son patron n'a rien resserré.
ALTER TABLE "membres_entreprise"
  ADD COLUMN IF NOT EXISTS "portee_planning" text NOT NULL DEFAULT 'tout';

ALTER TABLE "membres_entreprise"
  ADD CONSTRAINT "membres_entreprise_portee_connue"
  CHECK ("portee_planning" IN ('tout', 'ses_equipes'));

-- **L'ÉQUIPE RATTACHÉE — et pourquoi elle est nullable pour toujours.**
--
-- Dans Atlas, une « équipe » est une FILE DU PLANNING, pas un groupe de
-- personnes (`docs/QUESTIONS.md` §10) : « Équipe B » peut désigner deux ouvriers
-- qui n'ouvriront jamais l'application. Un commercial a un compte et ne conduit
-- aucun chantier ; le patron non plus n'est rattaché à aucune file. La colonne
-- ne vaut donc que pour un salarié dont la portée est resserrée — partout
-- ailleurs, NULL est l'état normal, pas une donnée manquante.
--
-- ON DELETE SET NULL, jamais CASCADE : supprimer une file du planning ne doit
-- pas supprimer le COMPTE de la personne qui la tenait.
ALTER TABLE "membres_entreprise"
  ADD COLUMN IF NOT EXISTS "equipe_id" uuid REFERENCES "equipes"("id") ON DELETE SET NULL;

-- **Une portée resserrée SANS équipe rattachée ne voit rien, et c'est voulu.**
-- L'inverse — « on ne sait pas quelle équipe, donc on montre tout » — rendrait
-- le resserrement silencieusement inopérant : le patron croirait avoir restreint.
-- Un planning vide se voit et se répare ; un planning entier ne se voit pas.

COMMENT ON COLUMN "membres_entreprise"."portee_planning" IS
  'Ce que la personne voit du planning : tout, ou les seuls chantiers de son équipe rattachée (décision du patron, 13 août 2026).';
COMMENT ON COLUMN "membres_entreprise"."equipe_id" IS
  'La file du planning que cette personne tient. NULL partout sauf pour un salarié à portée resserrée — une équipe n''est pas un compte.';
