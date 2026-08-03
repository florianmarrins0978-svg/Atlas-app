-- Demi-journées et équipes (TODO.md §5, demandé par le patron le 2026-08-03).
--
-- Jusqu'ici, un jour était pris ou libre, et une seule équipe était supposée.
-- Le patron : « si mon 1er chantier du 6 août ne dure que le matin, je ne peux
-- pas caler une autre demi-journée l'après-midi », et « si j'ai deux équipes,
-- je peux avoir deux chantiers le 6 août ».
--
-- Trois colonnes suffisent. Le calcul, lui, vit dans `src/server/disponibilites.ts`
-- — une seule règle, employée pour proposer les dates ET pour revérifier la
-- réponse du client.
--
-- **Ce que le client voit ne change pas** : la page publique continue de ne
-- recevoir que des DATES. Le créneau est une information du patron, et
-- c'est sa consigne explicite.

-- Le moment de la journée où le chantier commence. NULL sur tous les chantiers
-- déjà planifiés : ils sont alors lus comme « journée entière à partir du
-- matin », c'est-à-dire exactement ce qu'ils étaient. Supposer autre chose
-- libérerait, du jour au lendemain, des après-midis déjà pris.
ALTER TABLE "chantiers" ADD COLUMN "creneau_debut" text;

ALTER TABLE "chantiers"
  ADD CONSTRAINT "chantiers_creneau_debut_ck"
  CHECK ("creneau_debut" IS NULL OR "creneau_debut" IN ('matin', 'apres_midi'));

-- La durée réellement réservée, en demi-journées. Distincte de `duree_prevue`,
-- qui reste le texte dicté (« 2 jours ») : l'un se lit, l'autre se calcule, et
-- mélanger les deux ferait dépendre le planning d'une chaîne de caractères.
--
-- NULL = jamais renseignée : une journée entière est alors supposée.
ALTER TABLE "chantiers" ADD COLUMN "duree_demi_journees" integer;

ALTER TABLE "chantiers"
  ADD CONSTRAINT "chantiers_duree_demi_journees_ck"
  CHECK ("duree_demi_journees" IS NULL OR "duree_demi_journees" >= 1);

-- Combien de chantiers l'entreprise peut mener de front. Une équipe par défaut :
-- c'est le cas du patron aujourd'hui, et cette valeur reproduit exactement le
-- comportement d'avant cette migration.
ALTER TABLE "entreprises" ADD COLUMN "nombre_equipes" integer NOT NULL DEFAULT 1;

ALTER TABLE "entreprises"
  ADD CONSTRAINT "entreprises_nombre_equipes_ck"
  CHECK ("nombre_equipes" >= 1);

-- Le planning interroge « quels chantiers occupent cette fenêtre » à chaque
-- préparation d'envoi et à chaque réponse de client.
CREATE INDEX IF NOT EXISTS "chantiers_entreprise_date_planifiee_idx"
  ON "chantiers" ("entreprise_id", "date_planifiee")
  WHERE "deleted_at" IS NULL;
