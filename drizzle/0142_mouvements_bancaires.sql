-- POUR MON COMPTABLE, LOT 1 — sa remarque du 24 octobre 2026 : *« e-banking
-- permet de lire les virements entrants, mais pas les sortants ; il va falloir
-- le rajouter »*. Planche : `appli/pour-mon-comptable.html`.
--
-- La banque envoie déjà les deux sens dans la même réponse ; la lecture d'avant
-- jetait les débits (`virementsRecus`). Le dossier du comptable a besoin de
-- CHAQUE ligne du relevé, dans les deux sens.
--
-- **Une table à part, et non `virements_recus` élargie.** `virements_recus`
-- porte une question au patron (« ce virement paie-t-il cette facture ? ») et
-- son « oui » note un règlement ; une sortie n'a rien de tout cela. Mélanger
-- les deux aurait fait porter à chaque débit un `etat` de réponse qui n'a pas
-- de sens pour lui.
--
-- **Gardée au fil des lectures.** Les banques ne rendent d'ordinaire que
-- quatre-vingt-dix jours d'historique : un dossier d'un an ne se reconstitue
-- pas le jour où on l'arrête. Chaque lecture range ce qu'elle voit ; la clé
-- empêche de compter deux fois la même ligne.
--
-- Expand seul : une table neuve, aucune ligne existante touchée.

CREATE TABLE IF NOT EXISTS "mouvements_bancaires" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- La même clé que celle d'un virement reçu (`cleDuMouvement`) : la référence
  -- de la banque, ou à défaut une empreinte de ce qu'elle montre.
  "cle" text NOT NULL CHECK (length(btrim("cle")) > 0),
  "jour" date NOT NULL,
  -- Toujours positif : c'est `sens` qui dit si l'argent entre ou sort. Un
  -- montant signé laisserait un « − » se perdre dans une addition.
  "montant" numeric(12, 2) NOT NULL CHECK ("montant" > 0),
  "sens" text NOT NULL CHECK ("sens" IN ('entree', 'sortie')),
  -- Qui a payé (une entrée) ou qui a été payé (une sortie), quand la banque le
  -- dit. Vide sinon : il ne se devine pas.
  "contrepartie" text,
  "libelle" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mouvements_bancaires_cle_uk" ON "mouvements_bancaires" ("entreprise_id", "cle");
CREATE INDEX IF NOT EXISTS "mouvements_bancaires_jour_idx" ON "mouvements_bancaires" ("entreprise_id", "jour");

ALTER TABLE "mouvements_bancaires" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mouvements_bancaires" FORCE ROW LEVEL SECURITY;
CREATE POLICY "mouvements_bancaires_isolation" ON "mouvements_bancaires"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "mouvements_bancaires" TO atlas_app;

COMMENT ON TABLE "mouvements_bancaires" IS 'Chaque ligne du relevé bancaire, entrées et sorties, gardée au fil des lectures pour le dossier du comptable (24 octobre 2026).';
