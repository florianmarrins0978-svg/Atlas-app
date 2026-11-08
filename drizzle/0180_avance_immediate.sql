-- LE CRÉDIT D'IMPÔT DE SES CLIENTS, LOT 3 : L'AVANCE IMMÉDIATE (8 novembre 2026)
-- Planche `appli/soignee/credit-d-impot.html` : relier l'Urssaf, y inscrire un
-- client, lui envoyer une facture, la suivre. Règles pures dans
-- `src/lib/urssaf/avance-immediate.ts` et `src/lib/urssaf/branchement.ts`,
-- l'échange dans `src/server/urssaf/tiers-de-prestation.ts` (`ARCHITECTURE.md`
-- §574 et §577).
--
-- **Le numéro 0180** : 0176 et 0177 sont prises par deux sessions voisines,
-- 0178 et 0179 par les lots 1 et 2. Aucune branche ne porte encore de 0180
-- (relevé le 8 novembre 2026).
--
-- ════════════════════════════════════════════════════════════════════════════
-- EXPAND SEUL (`.claude/rules/deployment-safety.md`) : trois tables neuves, et
-- un moyen de règlement de plus dans deux listes permises. **Aucune ligne
-- existante n'est lue ni écrite** : pas d'UPDATE, rien à prouver sous FORCE
-- RLS (`.claude/rules/migrations.md`). Les deux contraintes élargies se
-- vérifient sur des lignes qui satisfont déjà la liste d'avant, plus courte.
-- Un code d'avant servi sur ce schéma ne voit pas les tables neuves, et
-- n'écrit jamais le moyen neuf ; le code du lot 3 ne les lit que pour une
-- entreprise déclarée aux services à la personne.

-- ─── La liaison avec l'Urssaf ──────────────────────────────────────────────
-- Une par entreprise : relier à nouveau remplace. **Les deux codes sont
-- CHIFFRÉS au repos** (`src/lib/chiffre-au-repos.ts`, domaine « urssaf ») :
-- ils font verser l'avance immédiate de ses clients. La contrainte de forme
-- refuse un code écrit en clair par une erreur de code : le chiffré commence
-- toujours par la version du format.
--
-- `id_tiers_facturation` (l'identifiant que l'Urssaf donne à l'entreprise) et
-- `code_nature` (la nature de ses prestations, que la description officielle
-- ne liste pas) ne sont pas des secrets : ils s'impriment sur chaque demande.
CREATE TABLE IF NOT EXISTS "liaisons_urssaf" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "client_id_chiffre" text NOT NULL,
  "client_secret_chiffre" text NOT NULL,
  "id_tiers_facturation" text NOT NULL,
  "code_nature" text NOT NULL,
  "reliee_le" timestamptz NOT NULL DEFAULT now(),
  "reliee_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "liaisons_urssaf_une_par_entreprise" UNIQUE ("entreprise_id"),
  CONSTRAINT "liaisons_urssaf_chiffres_ck" CHECK ("client_id_chiffre" ~ '^v1\.' AND "client_secret_chiffre" ~ '^v1\.'),
  CONSTRAINT "liaisons_urssaf_codes_ck" CHECK (btrim("id_tiers_facturation") <> '' AND btrim("code_nature") <> '')
);

ALTER TABLE "liaisons_urssaf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liaisons_urssaf" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'liaisons_urssaf' AND policyname = 'liaisons_urssaf_isolation') THEN
    CREATE POLICY "liaisons_urssaf_isolation" ON "liaisons_urssaf"
      USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
      WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "liaisons_urssaf" TO atlas_app;

-- ─── L'inscription d'un client ─────────────────────────────────────────────
-- Une par client. **Ce qui se garde, et ce qui ne se garde pas** (minimisation,
-- RGPD) :
--   - `id_client_urssaf`, rendu par l'Urssaf : chaque demande le porte ;
--   - `date_naissance` : l'Urssaf l'exige sur CHAQUE demande de paiement
--     (`dateNaissanceClient`), et la redemander à chaque facture serait pire ;
--   - l'état (`en_attente` : l'Urssaf lui a écrit, il doit accepter ;
--     `inscrit` : il a accepté) et sa date.
-- **L'IBAN et le BIC du client n'ont AUCUNE colonne** : ils partent à l'Urssaf,
-- qui y prélève sa moitié, et ne servent plus à Atlas. Une colonne vide « au cas
-- où » serait une donnée bancaire qui attend une fuite. Ni le lieu de naissance,
-- ni les prénoms : ils ne resservent à rien après l'inscription.
CREATE TABLE IF NOT EXISTS "inscriptions_urssaf" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL,
  "id_client_urssaf" text NOT NULL,
  "date_naissance" date NOT NULL,
  "etat" text NOT NULL DEFAULT 'en_attente',
  "etat_le" timestamptz NOT NULL DEFAULT now(),
  "demandee_le" timestamptz NOT NULL DEFAULT now(),
  -- La dernière relecture chez l'Urssaf : une par quelques minutes au plus.
  "lue_le" timestamptz,
  "inscrite_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "inscriptions_urssaf_client_fk" FOREIGN KEY ("client_id", "entreprise_id")
    REFERENCES "clients"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "inscriptions_urssaf_un_par_client" UNIQUE ("entreprise_id", "client_id"),
  CONSTRAINT "inscriptions_urssaf_etat_ck" CHECK ("etat" IN ('en_attente', 'inscrit')),
  CONSTRAINT "inscriptions_urssaf_id_ck" CHECK (btrim("id_client_urssaf") <> '')
);

ALTER TABLE "inscriptions_urssaf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inscriptions_urssaf" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inscriptions_urssaf' AND policyname = 'inscriptions_urssaf_isolation') THEN
    CREATE POLICY "inscriptions_urssaf_isolation" ON "inscriptions_urssaf"
      USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
      WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "inscriptions_urssaf" TO atlas_app;

-- ─── La demande de paiement d'une facture ──────────────────────────────────
-- Une par facture : elle part UNE fois, dans la transaction qui l'arrête
-- (`emettreFacture`, comme le dépôt sur la plateforme de facture
-- électronique). L'étape est celle que l'Urssaf rend, lue sur son libellé
-- (`etapeDeLaDemande`) ; `libelle_urssaf` garde ce libellé tel quel, pour
-- qu'une étape inconnue se montre sous son nom au lieu d'être devinée.
-- `paiement_id` : le règlement noté quand l'Urssaf a versé, pour ne jamais le
-- noter deux fois. Sans clé étrangère : un règlement retiré déménage dans
-- `reglements_retires` sous le même identifiant (0103).
CREATE TABLE IF NOT EXISTS "demandes_urssaf" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "facture_id" uuid NOT NULL,
  "id_demande_paiement" text NOT NULL,
  "etape" text NOT NULL DEFAULT 'integree',
  "libelle_urssaf" text,
  "envoyee_le" timestamptz NOT NULL DEFAULT now(),
  "etape_le" timestamptz NOT NULL DEFAULT now(),
  "validee_le" date,
  "lue_le" timestamptz,
  "montant_verse" numeric(12, 2),
  "versee_le" date,
  "paiement_id" uuid,
  "envoyee_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "demandes_urssaf_facture_fk" FOREIGN KEY ("facture_id", "entreprise_id")
    REFERENCES "factures"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "demandes_urssaf_une_par_facture" UNIQUE ("entreprise_id", "facture_id"),
  CONSTRAINT "demandes_urssaf_id_uk" UNIQUE ("entreprise_id", "id_demande_paiement"),
  CONSTRAINT "demandes_urssaf_id_ck" CHECK (btrim("id_demande_paiement") <> ''),
  CONSTRAINT "demandes_urssaf_etape_ck" CHECK ("etape" IN (
    'integree', 'en-attente-du-client', 'validee', 'refusee', 'prelevee',
    'impayee', 'versee', 'annulee', 'recouvree', 'inconnue'
  ))
);
CREATE INDEX IF NOT EXISTS "demandes_urssaf_a_relire_idx" ON "demandes_urssaf" ("entreprise_id", "etape");

ALTER TABLE "demandes_urssaf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demandes_urssaf" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'demandes_urssaf' AND policyname = 'demandes_urssaf_isolation') THEN
    CREATE POLICY "demandes_urssaf_isolation" ON "demandes_urssaf"
      USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
      WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "demandes_urssaf" TO atlas_app;

-- ─── Le moyen « avance immédiate » ─────────────────────────────────────────
-- Le versement de l'Urssaf se note par le chemin ordinaire des règlements,
-- avec ce moyen (`MoyenDePaiement`). La liste permise était écrite dans la
-- colonne (0045, 0103), donc sous un nom que PostgreSQL a choisi : on retire
-- toute contrainte de vérification qui porte la LISTE des moyens (le mot
-- « moyen » et la valeur « virement »), quel que soit son nom, puis l'on pose
-- la nouvelle sous un nom à nous. Retirer seulement le nom
-- supposé en laisserait une seconde, plus étroite, qui refuserait en silence
-- le règlement de l'Urssaf.
DO $$ DECLARE c record; BEGIN
  FOR c IN
    SELECT conrelid::regclass::text AS tab, conname FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('paiements_facture'::regclass, 'reglements_retires'::regclass)
      AND pg_get_constraintdef(oid) LIKE '%moyen%'
      AND pg_get_constraintdef(oid) LIKE '%virement%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tab, c.conname);
  END LOOP;
END $$;

ALTER TABLE "paiements_facture" ADD CONSTRAINT "paiements_facture_moyen_ck"
  CHECK ("moyen" IS NULL OR "moyen" IN ('virement', 'cheque', 'especes', 'carte', 'avance_immediate', 'autre'));
ALTER TABLE "reglements_retires" ADD CONSTRAINT "reglements_retires_moyen_ck"
  CHECK ("moyen" IS NULL OR "moyen" IN ('virement', 'cheque', 'especes', 'carte', 'avance_immediate', 'autre'));
