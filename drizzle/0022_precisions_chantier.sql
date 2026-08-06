-- Ce que le patron a répondu quand l'agent l'a arrêté avant de chiffrer.
--
-- **Pourquoi une table, et pas un champ du brouillon.** Le brouillon est la
-- lecture de la dictée : il se régénère dès qu'on relit la note vocale. Ses
-- réponses, elles, ne viennent pas de la dictée — elles viennent de lui. Les y
-- ranger reviendrait à les perdre à chaque relecture, et à le questionner deux
-- fois sur le même arbre. Ce serait la meilleure façon de lui faire abandonner
-- l'arrêt.
--
-- **Pourquoi ça compte.** Sur sa dictée du chêne mort, la technique et le
-- diamètre font varier le prix de 600 à 1 400 € (docs/EXEMPLE-DICTEE.md §4).
-- Ces deux lignes sont donc, littéralement, ce qui rend le devis juste.
--
-- C'est aussi la première pierre de la mémoire de l'agent : un couple
-- (ce qui a été demandé, ce qu'il a répondu), daté, rattaché à un chantier.

CREATE TABLE "precisions_chantier" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,
  -- Identifiant stable de la question (`abattage.technique#1`). C'est lui qui
  -- fait qu'une question déjà franchie ne se repose jamais.
  "sujet" text NOT NULL,
  -- La prestation concernée, mot pour mot au moment où la question a été posée.
  -- Conservée telle quelle : six mois plus tard, « abattage.technique#1 » seul
  -- ne dirait plus de quel arbre il s'agissait.
  "libelle_prestation" text NOT NULL,
  "valeur" text NOT NULL,
  -- Ce que ça donne à lire sur le devis (« démontage avec rétention », « ⌀ 70 cm »).
  -- Figé à la réponse plutôt que recalculé : le libellé d'une option peut être
  -- reformulé un jour, et un devis déjà émis ne doit pas changer de texte.
  "lisible" text NOT NULL,
  "repondu_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "precisions_chantier_uk" UNIQUE ("chantier_id", "sujet"),
  CONSTRAINT "precisions_chantier_valeur_non_vide" CHECK (btrim("valeur") <> ''),
  CONSTRAINT "precisions_chantier_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE CASCADE
);

CREATE INDEX "precisions_chantier_entreprise_chantier_idx"
  ON "precisions_chantier" ("entreprise_id", "chantier_id");

ALTER TABLE "precisions_chantier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "precisions_chantier" FORCE ROW LEVEL SECURITY;

CREATE POLICY "precisions_chantier_isolation" ON "precisions_chantier"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "precisions_chantier" TO atlas_app;
