-- LE CRÉDIT D'IMPÔT DE SES CLIENTS, LOT 1 (8 novembre 2026)
-- Planche `appli/soignee/credit-d-impot.html` : Mon entreprise, Le devis, La
-- facture. Règles pures dans `src/lib/services-a-la-personne.ts`.
--
-- **Le numéro 0178, et pas 0176.** Deux sessions voisines ont déjà pris 0176
-- (`0176_mon_annee`, `0176_telephone_du_chantier`) et une 0177, sur leurs
-- branches. Le lanceur applique tout fichier absent de `_migrations`, quel
-- que soit son rang ; un numéro libre évite seulement deux fichiers de même
-- rang à démêler à la fusion.
--
-- ════════════════════════════════════════════════════════════════════════════
-- EXPAND SEUL (`.claude/rules/deployment-safety.md`). Des colonnes neuves,
-- toutes nullables ou avec un défaut qui ne change rien à ce qui existe :
-- une entreprise n'est PAS déclarée, un devis et une facture ne portent PAS la
-- case. **Aucune ligne existante n'est lue ni écrite** : pas d'UPDATE, donc
-- rien à prouver sous FORCE RLS (`.claude/rules/migrations.md`). Les
-- contraintes ajoutées portent sur des colonnes neuves, vides partout.

-- ─── Mon entreprise ────────────────────────────────────────────────────────
-- La déclaration se DÉCLARE, elle ne se déduit pas, comme le régime de TVA.
-- Éteinte, le reste est gardé tel quel : la rallumer ne fait rien retaper.
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "sap_declaree" boolean NOT NULL DEFAULT false;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "sap_numero" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "sap_declaree_le" date;
-- Le logo des services à la personne, obligatoire sur les supports
-- commerciaux (R7232-19). La clé ET le format, comme le logo de l'entreprise
-- (`logo_storage_key`, `logo_mime`) : le PDF n'embarque un PNG et un JPEG
-- que par deux portes différentes, et deviner l'un d'après l'autre serait
-- une seconde règle.
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "sap_logo_cle" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "sap_logo_mime" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "sap_activite_a_cote" boolean NOT NULL DEFAULT false;
-- Le dernier numéro d'intervenant DONNÉ. Il ne redescend jamais : un numéro
-- qui part ne se redonne pas, sinon deux personnes le partagent sur deux
-- années d'attestations.
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "dernier_numero_intervenant" integer NOT NULL DEFAULT 0;

-- La même forme que la règle pure (`numeroSapValide`), ceinture et bretelles
-- comme les conditions du devis (0040) : un numéro faux s'imprimerait sur
-- chaque pièce. Vide partout aujourd'hui, la contrainte ne refuse rien.
ALTER TABLE "entreprises" DROP CONSTRAINT IF EXISTS "entreprises_sap_numero_ck";
ALTER TABLE "entreprises" ADD CONSTRAINT "entreprises_sap_numero_ck"
  CHECK ("sap_numero" IS NULL OR "sap_numero" ~ '^(SAP[0-9]{9}|SIR[0-9]{14})$');
ALTER TABLE "entreprises" DROP CONSTRAINT IF EXISTS "entreprises_dernier_numero_intervenant_ck";
ALTER TABLE "entreprises" ADD CONSTRAINT "entreprises_dernier_numero_intervenant_ck"
  CHECK ("dernier_numero_intervenant" >= 0);

-- ─── Le devis et la facture ────────────────────────────────────────────────
-- Une case pour tout le document, jamais ligne par ligne : une activité à
-- côté se facture à part. La facture née d'un devis la reprend.
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "services_a_la_personne" boolean NOT NULL DEFAULT false;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "services_a_la_personne" boolean NOT NULL DEFAULT false;

-- ─── Le numéro de chaque intervenant ───────────────────────────────────────
-- `equipes` porte les salariés (0067). Le numéro n'est NI le rang de la ligne
-- (il se renumérote quand on retire un salarié) NI le numéro de sécurité
-- sociale. NULL pour les lignes d'avant : elles reçoivent le leur à la
-- première lecture de l'équipe d'une entreprise déclarée
-- (`numerosDesIntervenants`), jamais ici, sous FORCE RLS.
ALTER TABLE "equipes" ADD COLUMN IF NOT EXISTS "numero_intervenant" integer;
ALTER TABLE "equipes" DROP CONSTRAINT IF EXISTS "equipes_numero_intervenant_ck";
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_numero_intervenant_ck"
  CHECK ("numero_intervenant" IS NULL OR "numero_intervenant" >= 1);
-- Unique par entreprise quand il existe : PostgreSQL laisse passer plusieurs
-- NULL dans une contrainte d'unicité, c'est exactement « quand non nul ».
ALTER TABLE "equipes" DROP CONSTRAINT IF EXISTS "equipes_numero_intervenant_uk";
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_numero_intervenant_uk" UNIQUE ("entreprise_id", "numero_intervenant");

-- **UN SEUL ENDROIT TIRE LE NUMÉRO.** Cinq chemins créent une ligne de
-- salarié (le nom, la photo de l'équipe, la photo d'une personne, l'absence,
-- la pose d'un chantier) : un appel dans chacun serait cinq copies, et la
-- sixième, demain, l'oublierait. Le déclencheur numérote toute ligne neuve ;
-- la lecture de l'équipe appelle la même fonction pour les lignes d'avant.
--
-- L'UPDATE pose un verrou sur la ligne de l'entreprise : deux salariés créés
-- en même temps attendent l'un l'autre et prennent deux numéros. `entreprises`
-- n'est pas sous RLS (0174) ; la ligne d'`equipes`, elle, l'est, et son
-- WITH CHECK garantit que `entreprise_id` est celle du contexte.
CREATE OR REPLACE FUNCTION tirer_numero_intervenant(p_entreprise uuid) RETURNS integer AS $$
DECLARE
  v_numero integer;
BEGIN
  UPDATE "entreprises"
     SET "dernier_numero_intervenant" = "dernier_numero_intervenant" + 1
   WHERE "id" = p_entreprise
   RETURNING "dernier_numero_intervenant" INTO v_numero;
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION numeroter_l_intervenant() RETURNS trigger AS $$
BEGIN
  IF NEW."numero_intervenant" IS NULL THEN
    NEW."numero_intervenant" := tirer_numero_intervenant(NEW."entreprise_id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_numero_intervenant ON "equipes";
CREATE TRIGGER trg_numero_intervenant
  BEFORE INSERT ON "equipes"
  FOR EACH ROW EXECUTE FUNCTION numeroter_l_intervenant();
