-- LE CRÉDIT D'IMPÔT DE SES CLIENTS, LOT 2 (8 novembre 2026)
-- Planche `appli/soignee/credit-d-impot.html` : le retour du jour (« Combien
-- d'heures ? ») et l'attestation de janvier. Règles pures dans
-- `src/lib/heures-d-intervention.ts` et `src/lib/attestation-fiscale.ts`.
--
-- **Le numéro 0179** : 0176 et 0177 sont prises par deux sessions voisines, et
-- 0178 par le lot 1. Aucune branche ne porte encore de 0179 (relevé le
-- 8 novembre 2026).
--
-- ════════════════════════════════════════════════════════════════════════════
-- EXPAND SEUL (`.claude/rules/deployment-safety.md`) : deux tables neuves.
-- **Aucune ligne existante n'est lue ni écrite** : rien à éprouver sur une
-- base habitée, rien à prouver sous FORCE RLS (`.claude/rules/migrations.md`).
-- Un code d'avant servi sur ce schéma ne les voit pas ; le code du lot 2 ne
-- les lit que pour une entreprise déclarée, donc nulle part avant qu'il en
-- déclare une.

-- ─── Les heures du retour du jour ──────────────────────────────────────────
-- Une ligne par chantier, par jour et par intervenant. **L'intervenant se
-- désigne par son NUMÉRO**, celui du lot 1 : il ne se redonne jamais (unique
-- par entreprise dans `equipes`), il tient d'une année d'attestations à
-- l'autre, et le patron, qui n'a pas de ligne d'équipe, a le sien (0). Une
-- clé étrangère vers `equipes` ne saurait pas dire le patron, et bloquerait
-- l'effacement d'une ligne que les heures doivent survivre.
--
-- **Le nom est celui ÉCRIT ce jour-là**, ou NULL. Une ligne d'équipe se
-- renomme (une correction, ou une autre personne sous le même rang : Atlas ne
-- sait pas laquelle, `ARCHITECTURE.md` §575) ; l'attestation doit dire qui
-- est venu. NULL n'invente rien : l'attestation lira alors le nom écrit
-- aujourd'hui sous le même numéro, ou dira qu'il manque.
CREATE TABLE IF NOT EXISTS "heures_d_intervention" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,
  "jour" date NOT NULL,
  "intervenant_numero" integer NOT NULL,
  "intervenant_nom" text,
  "minutes" integer NOT NULL,
  "pose_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "heures_d_intervention_chantier_fk" FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "heures_d_intervention_uk" UNIQUE ("entreprise_id", "chantier_id", "jour", "intervenant_numero"),
  CONSTRAINT "heures_d_intervention_numero_ck" CHECK ("intervenant_numero" >= 0),
  -- 0 h 01 à 24 h 59 : les deux roulettes (`MINUTES_MAX`). Zéro ne s'écrit
  -- pas, il efface : un intervenant sans heures n'a pas de ligne.
  CONSTRAINT "heures_d_intervention_minutes_ck" CHECK ("minutes" BETWEEN 1 AND 1499),
  -- Pas de nom vide : « pas de nom » s'écrit NULL, une seule façon de le dire.
  CONSTRAINT "heures_d_intervention_nom_ck" CHECK ("intervenant_nom" IS NULL OR btrim("intervenant_nom") <> '')
);
CREATE INDEX IF NOT EXISTS "heures_d_intervention_chantier_idx" ON "heures_d_intervention" ("entreprise_id", "chantier_id");

ALTER TABLE "heures_d_intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "heures_d_intervention" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'heures_d_intervention' AND policyname = 'heures_d_intervention_isolation') THEN
    CREATE POLICY "heures_d_intervention_isolation" ON "heures_d_intervention"
      USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
      WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "heures_d_intervention" TO atlas_app;

-- ─── Les attestations envoyées ─────────────────────────────────────────────
-- Une ligne par ENVOI, jamais réécrite : une attestation renvoyée après une
-- correction garde la trace de la première. L'empreinte dit ce que le papier
-- affirmait (`empreinteDeLAttestation`) : si ce qu'Atlas compose aujourd'hui
-- ne lui ressemble plus, l'écran dit « À renvoyer ». Le montant est gardé en
-- clair, pour qu'on sache ce qui est parti sans recomposer.
CREATE TABLE IF NOT EXISTS "attestations_fiscales_envoyees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL,
  "annee" integer NOT NULL,
  "montant" numeric(12, 2) NOT NULL,
  "empreinte" text NOT NULL,
  "envoyee_le" timestamptz NOT NULL DEFAULT now(),
  "envoyee_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "attestations_fiscales_envoyees_client_fk" FOREIGN KEY ("client_id", "entreprise_id")
    REFERENCES "clients"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "attestations_fiscales_envoyees_annee_ck" CHECK ("annee" BETWEEN 2000 AND 2100),
  CONSTRAINT "attestations_fiscales_envoyees_montant_ck" CHECK ("montant" > 0),
  CONSTRAINT "attestations_fiscales_envoyees_empreinte_ck" CHECK ("empreinte" ~ '^[0-9a-f]{8}$')
);
CREATE INDEX IF NOT EXISTS "attestations_fiscales_envoyees_annee_idx"
  ON "attestations_fiscales_envoyees" ("entreprise_id", "annee", "client_id");

ALTER TABLE "attestations_fiscales_envoyees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attestations_fiscales_envoyees" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attestations_fiscales_envoyees' AND policyname = 'attestations_fiscales_envoyees_isolation') THEN
    CREATE POLICY "attestations_fiscales_envoyees_isolation" ON "attestations_fiscales_envoyees"
      USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
      WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "attestations_fiscales_envoyees" TO atlas_app;
