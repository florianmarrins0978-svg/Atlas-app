-- ═══════════════════════════════════════════════════════════════════════════
-- LES ACOMPTES D'UN DEVIS — sa demande du 12 septembre 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- *« Rajouter la possibilité de rajouter un acompte automatisé sur le devis,
-- un peu comme on fait pour rajouter une TVA. »* Planche
-- `appli/l-acompte-sur-le-devis.html`, la B choisie le soir même : posé
-- d'office avec le taux des Réglages, un deuxième à mi-parcours sur les gros
-- devis, un troisième à l'avancement ; des taux CUMULÉS (30, puis 50, puis 75) ;
-- chez le client, « Reste à régler après acompte » et le montant.
--
-- ─── POURQUOI UNE TABLE, ET PAS UNE DEUXIÈME COLONNE ────────────────────────
--
-- `devis.acompte_pourcent` existe depuis la migration 0064 : c'est le RÉGLAGE
-- recopié sur le devis à sa création, la phrase que les notes et conditions
-- impriment. Il reste ce qu'il est — sa décision : *« si on clique sur le
-- moins, il disparaît mais reste visible dans les notes et conditions quoi
-- qu'il arrive »*. Retirer la ligne des totaux ne retire pas la condition.
--
-- Ce que le patron pose et retire devis par devis, ce sont des LIGNES dans les
-- totaux — une, deux ou trois. Une colonne par acompte aurait figé le nombre ;
-- une ligne par acompte le laisse libre, et le troisième n'a rien demandé de
-- plus que le deuxième.
--
-- ─── CE QUE PORTE UNE LIGNE ─────────────────────────────────────────────────
--
-- Son rang (1, 2, 3 — le moment se lit du rang : signature, mi-parcours,
-- avancement, `src/lib/acomptes-devis.ts`) et son taux CUMULÉ : « 50 » au rang
-- 2 veut dire qu'à mi-parcours la moitié du devis est réglée. Ce qui tombe ce
-- jour-là est la différence avec l'acompte d'avant, et se CALCULE — jamais
-- stocké, sinon il divergerait du TTC à la première ligne ajoutée.
--
-- ─── UN DEVIS ENVOYÉ NE BOUGE PLUS, SES ACOMPTES NON PLUS ───────────────────
--
-- Le trigger d'immuabilité du devis ne couvre que sa propre table. Le même
-- refus s'écrit ici : l'échéancier fait partie de ce que le client a accepté.

CREATE TABLE IF NOT EXISTS "acomptes_devis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "devis_id" uuid NOT NULL REFERENCES "devis"("id") ON DELETE CASCADE,

  "rang" smallint NOT NULL,
  "taux_cumule" numeric(5, 2) NOT NULL,

  "created_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "acomptes_devis_rang_connu" CHECK ("rang" BETWEEN 1 AND 3),
  CONSTRAINT "acomptes_devis_taux_borne" CHECK ("taux_cumule" >= 0 AND "taux_cumule" <= 100)
);

-- Deux acomptes au même rang n'ont aucun sens : un double appui, deux onglets.
CREATE UNIQUE INDEX IF NOT EXISTS "acomptes_devis_unique"
  ON "acomptes_devis" ("devis_id", "rang");

ALTER TABLE "acomptes_devis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acomptes_devis" FORCE ROW LEVEL SECURITY;
CREATE POLICY "acomptes_devis_isolation" ON "acomptes_devis"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- L'échéancier d'un devis parti est ce que le client a accepté : il ne se
-- corrige plus, il se refait dans une nouvelle version.
CREATE OR REPLACE FUNCTION "refuser_acompte_sur_devis_envoye"() RETURNS trigger AS $$
DECLARE
  statut_du_devis text;
BEGIN
  SELECT "statut" INTO statut_du_devis FROM "devis"
    WHERE "id" = COALESCE(NEW."devis_id", OLD."devis_id");
  IF statut_du_devis = 'envoye' THEN
    RAISE EXCEPTION 'Les acomptes d''un devis envoyé ne se modifient plus (devis %).',
      COALESCE(NEW."devis_id", OLD."devis_id");
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "acomptes_devis_immuables" ON "acomptes_devis";
CREATE TRIGGER "acomptes_devis_immuables"
  BEFORE INSERT OR UPDATE OR DELETE ON "acomptes_devis"
  FOR EACH ROW EXECUTE FUNCTION "refuser_acompte_sur_devis_envoye"();

COMMENT ON TABLE "acomptes_devis" IS
  'Les lignes d''acompte des totaux d''un devis (12 septembre 2026) : un rang '
  '(1 signature, 2 mi-parcours, 3 avancement) et un taux CUMULÉ. Ce qui tombe '
  'à chaque acompte se calcule (src/lib/acomptes-devis.ts). devis.acompte_pourcent '
  'reste le réglage recopié, imprimé dans les notes quoi qu''il arrive.';
