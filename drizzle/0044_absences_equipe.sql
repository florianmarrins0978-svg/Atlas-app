-- =========================================================================
-- Une équipe qui n'est pas là, et les jours où elle ne l'est pas
-- =========================================================================
--
-- **Le patron, le 14 août 2026 :** *« Comment on fait si jamais il y a une
-- équipe qui doit partir en déplacement pour cinq jours ? »*
--
-- Retenu sur maquette (`docs/maquettes/55`, proposition A) : les absences se
-- posent sous les noms, dans Réglages → Équipe.
--
-- ─────────────────────────────────────────────────────────────────────────
-- **CE QUI EXISTAIT DÉJÀ, ET QUE CETTE TABLE NE REMPLACE PAS.**
--
-- Si TOUTE l'entreprise part, l'agenda extérieur relié suffit : une période de
-- plusieurs jours occupe toutes les demi-journées qu'elle traverse
-- (`src/lib/agenda-externe.ts`). Cette table sert l'autre cas — **une équipe
-- sur deux** —, où l'agenda bloquerait aussi celle qui reste.
--
-- ─────────────────────────────────────────────────────────────────────────
-- **POURQUOI DES JOURS ENTIERS, ET PAS DES DEMI-JOURNÉES.**
--
-- Le planning d'Atlas raisonne en demi-journées, et on aurait pu suivre. Mais
-- un déplacement, un congé, un arrêt ne se comptent pas ainsi : personne ne
-- part « du mardi après-midi au jeudi matin ». Offrir la demi-journée ici,
-- c'est offrir un réglage que le patron devra remplir sans en avoir besoin —
-- et deux champs de plus sur un écran de six pouces.
--
-- Le jour où une demi-journée d'absence sera demandée, elle s'ajoutera : les
-- deux colonnes sont des DATES, la précision se rajoute sans se contredire.
--
-- ─────────────────────────────────────────────────────────────────────────
-- **CE QUE CETTE TABLE N'EST PAS.**
--
-- Ce n'est pas un registre de congés : ni solde, ni compteur, ni validation,
-- ni salarié. Une équipe est une FILE DU PLANNING, pas une personne
-- (`ARCHITECTURE.md` §88) — et Atlas prépare des devis, il ne tient pas la
-- paie. Le motif est un texte libre, purement pour que le patron se souvienne
-- de ce qu'il a noté ; il n'entre dans aucun calcul.

CREATE TABLE "absences_equipe" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- **L'équipe visée, et ce qui se passe si elle disparaît.** `CASCADE` plutôt
  -- que `SET NULL` : une absence sans équipe ne veut plus rien dire, et une
  -- ligne orpheline retirerait de la capacité sans que rien à l'écran ne dise
  -- laquelle. Mieux vaut qu'elle parte avec.
  "equipe_id" uuid NOT NULL REFERENCES "equipes"("id") ON DELETE CASCADE,

  -- Bornes INCLUSES des deux côtés — « du 8 au 12 » comprend le 8 et le 12,
  -- comme le patron l'écrirait. Une absence d'un seul jour porte deux fois la
  -- même date, et c'est un cas ordinaire.
  "premier_jour" date NOT NULL,
  "dernier_jour" date NOT NULL,

  -- **Une absence à l'envers ne doit pas pouvoir exister.** L'écran l'empêche
  -- déjà ; la base le tient quand même, parce qu'une ligne inversée
  -- n'occuperait AUCUN jour et rendrait la capacité fausse en silence — le
  -- pire des défauts, celui qui ne se voit qu'au moment où un client retient
  -- une date qu'on ne peut pas tenir.
  CONSTRAINT "absences_equipe_ordre_ck" CHECK ("dernier_jour" >= "premier_jour"),

  -- Ce que le patron a noté pour s'en souvenir. Jamais lu par un calcul.
  "motif" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  -- Retrait en douceur, comme partout ailleurs : une absence supprimée par
  -- erreur rendrait des dates que le patron croyait bloquées.
  "deleted_at" timestamptz
);

-- Le planning demande toujours « quelles absences entre ces deux dates ? ».
CREATE INDEX "absences_equipe_fenetre_idx"
  ON "absences_equipe" ("entreprise_id", "premier_jour", "dernier_jour")
  WHERE "deleted_at" IS NULL;

ALTER TABLE "absences_equipe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "absences_equipe" FORCE ROW LEVEL SECURITY;

CREATE POLICY "absences_equipe_isolation" ON "absences_equipe"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "absences_equipe" TO atlas_app;
