-- LES ÉQUIPES D'UN CHANTIER, DEMI-JOURNÉE PAR DEMI-JOURNÉE
--
-- **Ses deux demandes du 21 août 2026, éprouvées sur maquette avant d'être
-- codées** (`appli/planning-simple.html`, planche 84) :
--
--   · *« lorsque je choisis une équipe je dois pouvoir mettre TOUTES les
--     équipes si je le souhaite, le même jour ou même sur la même demi-journée.
--     Je dois pouvoir mettre tout le monde le matin puis tout le monde
--     l'aprem. »*
--   · *« sur Mr. Leroy, qui dure toute la journée, je ne peux pas mettre juste
--     Paul le matin et Julien et Paul l'après-midi — si je mets les deux
--     l'après-midi, ça me les met aussi le matin. Il faut que tout soit
--     INDÉPENDANT. »*
--
-- `chantiers.equipe_id` ne pouvait répondre ni à l'une ni à l'autre : une
-- colonne porte UNE équipe, et elle la porte pour le chantier entier. C'est la
-- réalité du métier qui manquait — on démarre à deux, on renforce l'après-midi.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI `chantiers.equipe_id` DISPARAÎT, ET N'EST PAS SIMPLEMENT DOUBLÉE
--
-- La garder aurait été la solution courte : les écrans qui la lisent
-- continuaient de fonctionner, et la nouvelle table servait au seul planning.
-- Elle aurait aussi été la faute que `CLAUDE.md` §3 interdit — deux
-- implémentations de la même règle finissent toujours par diverger. Concrètement :
-- le patron retire Paul de l'après-midi sur le planning, la colonne dit encore
-- « Paul », et la feuille de route imprimée l'envoie sur place.
--
-- Les lignes existantes sont donc RECOPIÉES dans la nouvelle table — sur les
-- deux demi-journées, parce que c'est exactement ce que la colonne voulait dire
-- — puis la colonne est retirée. Un chantier sans équipe n'en reçoit aucune :
-- rien ne permet de deviner après coup qui l'a fait, et inventer serait pire
-- que vide (`docs/AGENT.md` §3).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "equipes_du_chantier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- **`entreprise_id` porté ici aussi**, et ce n'est pas une redondance : c'est
  -- ce qui permet à la RLS de trancher sans jointure. Une politique qui devrait
  -- remonter au chantier pour savoir à qui appartient la ligne serait plus
  -- lente et plus facile à contourner.
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,

  -- La demi-journée concernée. Les mêmes deux mots que `chantiers.creneau_debut`
  -- et que `Moment` dans `src/server/disponibilites.ts` : un troisième
  -- vocabulaire pour la même chose obligerait à traduire à chaque frontière, et
  -- c'est en traduisant qu'on se trompe.
  "demi" text NOT NULL CHECK ("demi" IN ('matin', 'apres_midi')),

  -- **`ON DELETE CASCADE` et non `SET NULL`** : contrairement à la colonne
  -- qu'elle remplace, une ligne d'ici ne veut rien dire sans son équipe. Une
  -- équipe supprimée ne laisse pas un chantier « attribué à personne » — elle
  -- le laisse à attribuer, ce qui est la vérité.
  "equipe_id" uuid NOT NULL REFERENCES "equipes"("id") ON DELETE CASCADE,

  "created_at" timestamptz NOT NULL DEFAULT now(),

  -- Deux fois la même équipe sur la même demi-journée compterait deux fois dans
  -- la charge, et l'écran dirait « Paul, Paul ».
  CONSTRAINT "equipes_du_chantier_uk" UNIQUE ("chantier_id", "demi", "equipe_id"),

  -- FK composite : une ligne ne peut désigner qu'un chantier de SA propre
  -- entreprise. Sans elle, l'isolation reposerait sur la seule discipline du
  -- code (`CLAUDE.md` §4).
  CONSTRAINT "equipes_du_chantier_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE CASCADE
);

-- Le planning lit toujours « les équipes de CE chantier », jamais l'inverse.
CREATE INDEX "equipes_du_chantier_idx"
  ON "equipes_du_chantier" ("entreprise_id", "chantier_id");

ALTER TABLE "equipes_du_chantier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "equipes_du_chantier" FORCE ROW LEVEL SECURITY;

CREATE POLICY "equipes_du_chantier_isolation" ON "equipes_du_chantier"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "equipes_du_chantier" TO atlas_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA REPRISE DE L'EXISTANT — sur les DEUX demi-journées
--
-- `chantiers.equipe_id` disait « cette équipe tient ce chantier », sans
-- distinguer le matin de l'après-midi. La recopier sur une seule des deux
-- moitiés retirerait une information que personne n'a demandé à retirer : un
-- chantier à la journée perdrait son équipe l'après-midi, en silence.
--
-- ───────────────────────────────────────────────────────────────────────────
-- **ELLE BOUCLE PAR ENTREPRISE, ET CE N'EST PAS UN ORNEMENT.**
--
-- Écrite d'abord en un seul `INSERT … SELECT FROM chantiers`, elle recopiait
-- ZÉRO ligne — sans la moindre erreur. `chantiers` porte `FORCE ROW LEVEL
-- SECURITY` : la politique s'applique **même au propriétaire de la table**, et
-- les migrations tournent justement sous `atlas_owner` (`CLAUDE.md` §5). Sans
-- `app.entreprise_id`, la lecture ne rend rien.
--
-- Le défaut était donc SILENCIEUX et définitif : la colonne aurait été retirée
-- juste après, et toutes les équipes déjà affectées auraient disparu de la base
-- du patron sans qu'aucun message ne le dise. Trouvé en rejouant la migration
-- sur une base à l'état d'avant, avec des données dedans — jamais en la
-- relisant.
--
-- C'est la mécanique des migrations 0036 et 0037, et pour la même raison. Le
-- `RAISE NOTICE` final n'est pas décoratif : une reprise qui ne recopie rien
-- doit se voir dans le journal, pas se deviner.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  ent record;
  touches integer;
  total integer := 0;
BEGIN
  FOR ent IN SELECT id FROM entreprises LOOP
    -- `true` : le réglage vaut pour la transaction seule. La migration ne
    -- laisse donc aucun contexte derrière elle.
    PERFORM set_config('app.entreprise_id', ent.id::text, true);

    INSERT INTO "equipes_du_chantier" ("entreprise_id", "chantier_id", "demi", "equipe_id")
    SELECT c."entreprise_id", c."id", d."demi", c."equipe_id"
      FROM "chantiers" c
      CROSS JOIN (VALUES ('matin'), ('apres_midi')) AS d("demi")
     WHERE c."equipe_id" IS NOT NULL
       AND c."deleted_at" IS NULL;

    GET DIAGNOSTICS touches = ROW_COUNT;
    total := total + touches;
  END LOOP;

  PERFORM set_config('app.entreprise_id', '', true);
  RAISE NOTICE 'Équipes reprises, demi-journée par demi-journée : %', total;
END $$;

ALTER TABLE "chantiers" DROP COLUMN "equipe_id";
