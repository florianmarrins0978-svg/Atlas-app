-- POUR MON COMPTABLE, LOT 6 : l'attestation que le comptable signe.
-- Sa remarque du 27 octobre 2026, après avoir joué le comptable : « j'ai coché
-- vert, rouge, et ensuite aucun moyen d'arrêter le document, de le signer ».
-- Sa planche du même jour (`appli/soignee/comptable-attestation.html`) : il
-- conclut, se présente, signe sur l'attestation, et elle revient au patron.
--
-- **EXPAND SEUL** : une table neuve, aucune ligne existante touchée.

CREATE TABLE IF NOT EXISTS "attestations_comptable" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "dossier_id" uuid NOT NULL,
  "conclusion" text NOT NULL CHECK ("conclusion" IN ('conforme', 'reserves', 'non_conforme')),
  "observations" text CHECK ("observations" IS NULL OR length("observations") <= 1000),
  -- Les comptes au moment de la signature, faits au serveur sur les verdicts :
  -- le patron corrige une ligne ensuite, l'attestation garde ce qu'elle a dit.
  "lignes" integer NOT NULL CHECK ("lignes" > 0),
  "validees" integer NOT NULL CHECK ("validees" >= 0),
  "rejetees" integer NOT NULL CHECK ("rejetees" >= 0),
  "signataire_nom" text NOT NULL CHECK (length(btrim("signataire_nom")) BETWEEN 2 AND 120),
  "signataire_fonction" text NOT NULL CHECK ("signataire_fonction" IN ('expert_comptable', 'comptable', 'autre')),
  "signataire_societe" text NOT NULL CHECK (length(btrim("signataire_societe")) BETWEEN 1 AND 160),
  "signataire_ordre" text CHECK ("signataire_ordre" IS NULL OR length("signataire_ordre") <= 40),
  "signataire_siren" text CHECK ("signataire_siren" IS NULL OR "signataire_siren" ~ '^[0-9]{3} [0-9]{3} [0-9]{3}$'),
  "signataire_adresse" text CHECK ("signataire_adresse" IS NULL OR length("signataire_adresse") <= 200),
  "signataire_email" text NOT NULL CHECK (length("signataire_email") <= 200),
  "signataire_telephone" text CHECK ("signataire_telephone" IS NULL OR length("signataire_telephone") <= 40),
  -- Le PDF signé, et son empreinte : dix ans plus tard, elle dit que le fichier
  -- est celui qui a été signé, octet pour octet (comme le dossier, 0144).
  "fichier_cle" text NOT NULL CHECK (length(btrim("fichier_cle")) > 0),
  "taille_octets" integer NOT NULL CHECK ("taille_octets" > 0),
  "empreinte" text NOT NULL CHECK (length("empreinte") = 64),
  "signe_le" timestamptz NOT NULL DEFAULT now(),
  -- « J'ai vu » sur la carte de l'accueil : la seule colonne qui bouge.
  "vu_le" timestamptz,
  CONSTRAINT "attestations_comptable_comptes_check" CHECK ("validees" + "rejetees" = "lignes"),
  -- Le dossier de la MÊME entreprise, par la clé double (comme 0145).
  CONSTRAINT "attestations_comptable_dossier_fk" FOREIGN KEY ("dossier_id", "entreprise_id")
    REFERENCES "dossiers_comptables"("id", "entreprise_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "attestations_comptable_dossier_idx" ON "attestations_comptable" ("entreprise_id", "dossier_id", "signe_le" DESC);

ALTER TABLE "attestations_comptable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attestations_comptable" FORCE ROW LEVEL SECURITY;
-- Le comptable écrit sous l'isolation ordinaire : son jeton ouvre d'abord SON
-- envoi, qui pose l'entreprise (`ouvrir`, `verification-comptable.ts`), comme
-- pour ses verdicts. Aucune politique de plus.
CREATE POLICY "attestations_comptable_isolation" ON "attestations_comptable"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
-- **Une attestation signée ne se réécrit pas et ne s'efface pas.** Les
-- privilèges par défaut donnent les quatre droits (0081) : on les retire, et
-- l'on rend la seule colonne que « J'ai vu » écrit.
GRANT SELECT, INSERT ON "attestations_comptable" TO atlas_app;
REVOKE UPDATE, DELETE ON "attestations_comptable" FROM atlas_app;
GRANT UPDATE ("vu_le") ON "attestations_comptable" TO atlas_app;

COMMENT ON TABLE "attestations_comptable" IS 'L''attestation que le comptable signe sur son lien, conclusion, signataire et PDF, jamais réécrite (27 octobre 2026).';
