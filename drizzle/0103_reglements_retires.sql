-- Un règlement retiré laisse sa trace.
--
-- **Sa planche du 26 septembre 2026 (`appli/retirer-un-acompte.html`, « la
-- B »).** La croix au bout d'un acompte SUPPRIMAIT la ligne de
-- `paiements_facture`. Un acompte encaissé en juillet et retiré en septembre
-- faisait baisser la TVA collectée de juillet, un mois déjà déclaré, et plus
-- rien ne disait ni quoi ni quand.
--
-- =========================================================================
-- Pourquoi une TABLE, et non une colonne « retiré le » sur paiements_facture
-- =========================================================================
--
-- Dix endroits du code additionnent `paiements_facture` : le reste dû, l'état
-- de la facture, le relevé de TVA, les rappels, la fiche du client, le PDF.
-- Une colonne obligerait chacun à ajouter « et pas retiré » ; en oublier UN
-- compterait un règlement retiré dans la TVA, sans erreur. Déplacé ici, un
-- règlement retiré cesse d'exister pour tous ces calculs sans qu'aucun ne
-- change, et « Remettre » le ramène avec le même identifiant.
--
-- Rien d'existant ne bouge : la table est neuve, aucune ligne n'est écrite, la
-- migration est sans effet sur les données déjà là (pas de RLS à franchir).

CREATE TABLE "reglements_retires" (
  -- Le même identifiant que dans `paiements_facture` : « Remettre » le rend tel
  -- quel, et un lien qui le désignait continue de le désigner.
  "id" uuid PRIMARY KEY,
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "facture_id" uuid NOT NULL,
  "date_paiement" date NOT NULL,
  "montant" numeric(12, 2) NOT NULL CHECK ("montant" > 0),
  "moyen" text CHECK ("moyen" IS NULL OR "moyen" IN ('virement', 'cheque', 'especes', 'carte', 'autre')),
  "note" text,
  "numero" text,
  "libelle" text,
  "solde" boolean NOT NULL DEFAULT false,
  "origine" text NOT NULL CHECK ("origine" IN ('saisi', 'reprise', 'banque')),
  -- Quand le règlement avait été noté, gardé tel quel : c'est une trace.
  "created_at" timestamptz NOT NULL,
  "retire_le" timestamptz NOT NULL DEFAULT now(),
  "retire_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "reglements_retires_facture_entreprise_fk"
    FOREIGN KEY ("facture_id", "entreprise_id") REFERENCES "factures"("id", "entreprise_id")
);

CREATE INDEX "reglements_retires_facture_idx" ON "reglements_retires" ("entreprise_id", "facture_id");

ALTER TABLE "reglements_retires" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reglements_retires" FORCE ROW LEVEL SECURITY;
CREATE POLICY "reglements_retires_isolation" ON "reglements_retires"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- DELETE pour « Remettre » : la ligne repart dans `paiements_facture`. Aucun
-- UPDATE : une trace ne se réécrit pas.
GRANT SELECT, INSERT, DELETE ON "reglements_retires" TO atlas_app;
