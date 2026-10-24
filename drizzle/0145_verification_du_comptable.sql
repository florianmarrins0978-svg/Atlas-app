-- POUR MON COMPTABLE, LOT 4 — le comptable vérifie, par un lien privé.
-- Ses choix du 24 octobre 2026 (`TODO.md`, écran 7 de la planche) : un lien,
-- le justificatif cliquable, Valider ou Rejeter par ligne, puis Suivant ; un
-- rejet demande pourquoi et revient au patron dans Atlas.
--
-- **EXPAND SEUL** : deux tables neuves, et sur `mouvements_bancaires` une
-- contrainte (`id`, `entreprise_id`) qui ne peut pas échouer sur une base
-- habitée, `id` étant déjà unique.

ALTER TABLE "mouvements_bancaires"
  ADD CONSTRAINT "mouvements_bancaires_id_entreprise_uk" UNIQUE ("id", "entreprise_id");

-- Un lien par appui sur « Envoyer au comptable ». **La base ne garde que
-- l'empreinte du jeton** (SHA-256, comme le mot de passe oublié) : lue
-- par-dessus l'épaule, elle n'ouvre rien. Le lien ne se remontre donc pas ;
-- un nouvel appui en fait un autre, et l'ancien vit jusqu'à son terme.
CREATE TABLE IF NOT EXISTS "envois_comptable" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "dossier_id" uuid NOT NULL,
  "jeton_empreinte" text NOT NULL UNIQUE CHECK (length("jeton_empreinte") = 64),
  "cree_par" uuid REFERENCES "users"("id"),
  "cree_le" timestamptz NOT NULL DEFAULT now(),
  "expire_le" timestamptz NOT NULL,
  CONSTRAINT "envois_comptable_dossier_fk" FOREIGN KEY ("dossier_id", "entreprise_id")
    REFERENCES "dossiers_comptables"("id", "entreprise_id") ON DELETE CASCADE
);

-- Le verdict du comptable, UN par ligne et par dossier, quel que soit le lien
-- qui l'a posé : deux liens du même dossier montrent la même vérification.
CREATE TABLE IF NOT EXISTS "verdicts_comptable" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "dossier_id" uuid NOT NULL,
  "mouvement_id" uuid NOT NULL,
  "verdict" text NOT NULL CHECK ("verdict" IN ('valide', 'rejete')),
  "note" text CHECK ("note" IS NULL OR length("note") <= 1000),
  -- Il l'avait validée avant de la rejeter : le patron lit « changement ».
  "avait_valide" boolean NOT NULL DEFAULT false,
  -- La justification de la ligne au moment du verdict. Le patron la corrige
  -- après un rejet : le verdict ne vaut plus, la ligne revient « à vérifier ».
  "ligne_justifiee_le" timestamptz,
  "pose_le" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "verdicts_comptable_dossier_fk" FOREIGN KEY ("dossier_id", "entreprise_id")
    REFERENCES "dossiers_comptables"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "verdicts_comptable_mouvement_fk" FOREIGN KEY ("mouvement_id", "entreprise_id")
    REFERENCES "mouvements_bancaires"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "verdicts_comptable_ligne_uk" UNIQUE ("dossier_id", "mouvement_id")
);
CREATE INDEX IF NOT EXISTS "verdicts_comptable_dossier_idx" ON "verdicts_comptable" ("entreprise_id", "dossier_id");

ALTER TABLE "envois_comptable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envois_comptable" FORCE ROW LEVEL SECURITY;
CREATE POLICY "envois_comptable_isolation" ON "envois_comptable"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- Le comptable n'a pas de session : la lecture s'ouvre sur l'empreinte EXACTE
-- de son jeton, posée par le code juste avant (comme le devis, 0015). Sans
-- elle, aucune ligne. Le reste se lit ensuite sous l'isolation ordinaire.
CREATE POLICY "envois_comptable_lecture_par_jeton" ON "envois_comptable"
  FOR SELECT
  USING ("jeton_empreinte" = NULLIF(current_setting('app.jeton_comptable', true), ''));
-- Un lien ne se réécrit pas : les privilèges par défaut donnent les quatre
-- droits (0081), on retire les deux autres (comme 0123 et 0144).
GRANT SELECT, INSERT ON "envois_comptable" TO atlas_app;
REVOKE UPDATE, DELETE ON "envois_comptable" FROM atlas_app;

ALTER TABLE "verdicts_comptable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verdicts_comptable" FORCE ROW LEVEL SECURITY;
CREATE POLICY "verdicts_comptable_isolation" ON "verdicts_comptable"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- Un verdict se change (il revient sur une ligne) et s'enlève (un second appui
-- sur le même rond défait l'erreur).
GRANT SELECT, INSERT, UPDATE, DELETE ON "verdicts_comptable" TO atlas_app;

COMMENT ON TABLE "envois_comptable" IS 'Les liens privés donnés au comptable pour vérifier un dossier, par empreinte de jeton (24 octobre 2026).';
COMMENT ON TABLE "verdicts_comptable" IS 'Valider ou rejeter, ligne par ligne, posé par le comptable depuis son lien (24 octobre 2026).';
