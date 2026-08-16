-- La TVA quand le client paie — et l'endroit où les factures attendent.
--
-- **Sa demande, le 14 août 2026 :** *« si demain un client décide de ne pas me
-- payer une facture… est-ce qu'il y a une possibilité pour que la facture rentre
-- au relevé de TVA seulement une fois que le client m'a payé ? »* Puis, sur la
-- forme exacte : *« lorsque la facture part, au lieu qu'elle rentre directement
-- dans le relevé, elle arrive dans un endroit en attente ; lorsque j'ai reçu le
-- paiement, je retourne dessus, je clique sur valider, et boum, elle va dans le
-- relevé. »*
--
-- =========================================================================
-- Pourquoi il a raison, et pourquoi le défaut CHANGE
-- =========================================================================
--
-- Pour une **prestation de services**, la TVA est exigible **à l'encaissement**
-- (CGI art. 269-2-c). Le régime des **débits** — celui qu'Atlas appliquait
-- depuis toujours — est une **OPTION**, qui se demande à l'administration. Un
-- artisan qui ne l'a jamais demandée était donc invité, par l'application, à
-- déclarer trop tôt : à avancer la TVA d'un client qui n'avait pas payé.
--
-- Le défaut devient donc `encaissements`. Le réglage existe parce que les deux
-- régimes existent : `docs/QUESTIONS.md` §19, `docs/A-FAIRE.md` §11.
--
-- =========================================================================
-- CE QUI NE DOIT PAS BOUGER : les relevés DÉJÀ DÉCLARÉS
-- =========================================================================
--
-- C'est le seul vrai danger de cette migration. Changer le régime sans rien
-- faire d'autre ferait **sortir du relevé toutes les factures déjà émises** —
-- un trimestre déclaré à 400 € retomberait à 0 €, et l'écran contredirait un
-- formulaire déjà envoyé aux impôts.
--
-- Chaque facture déjà émise reçoit donc **un règlement daté du jour de son
-- émission, pour son total TTC**. Aux encaissements comme aux débits, elle
-- apporte exactement ce qu'elle apportait hier, dans la même période. Rien ne
-- bouge dans le passé ; la règle nouvelle ne vaut que pour ce qui suit.
--
-- **Ce n'est pas une supposition déguisée en donnée** : ces règlements portent
-- `origine = 'reprise'`, et l'écran le dit — « supposé réglé à l'émission ».
-- Un artisan qui sait qu'une de ces factures n'a jamais été payée peut le
-- corriger d'un geste, et sa TVA repartira au trimestre où il l'encaissera.

-- =========================================================================
-- Le régime de l'entreprise
-- =========================================================================

ALTER TABLE "entreprises"
  ADD COLUMN IF NOT EXISTS "tva_exigibilite" text NOT NULL DEFAULT 'encaissements';

ALTER TABLE "entreprises"
  DROP CONSTRAINT IF EXISTS "entreprises_tva_exigibilite_connue";

ALTER TABLE "entreprises"
  ADD CONSTRAINT "entreprises_tva_exigibilite_connue"
  CHECK ("tva_exigibilite" IN ('encaissements', 'debits'));

-- =========================================================================
-- Les règlements reçus
-- =========================================================================

CREATE TABLE "paiements_facture" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "facture_id" uuid NOT NULL REFERENCES "factures"("id") ON DELETE CASCADE,

  -- **Une date civile, pas un horodatage.** C'est elle qui décide du mois ou du
  -- trimestre de déclaration : un fuseau horaire mal choisi ferait basculer un
  -- règlement du 31 mars au 1er avril, donc d'un trimestre à l'autre.
  "date_paiement" date NOT NULL,

  -- Le montant REÇU, en TTC. La part de TVA n'est pas stockée : elle se calcule
  -- au prorata (`entreesDuReleve`). La figer ici la ferait diverger de la
  -- facture le jour où un avoir la corrige.
  "montant" numeric(12, 2) NOT NULL CHECK ("montant" > 0),

  -- Ce que le patron veut relire pour s'y retrouver — jamais un calcul.
  "moyen" text CHECK ("moyen" IS NULL OR "moyen" IN ('virement', 'cheque', 'especes', 'carte', 'autre')),
  "note" text,

  -- D'où vient ce règlement. `saisi` : son geste. `reprise` : posé par cette
  -- migration pour ne pas déplacer un relevé déjà déclaré (voir l'en-tête).
  -- `banque` est réservé au rapprochement bancaire à venir (`A-FAIRE.md` §12) :
  -- la colonne existe pour que ce jour-là, on n'ait pas à distinguer après coup
  -- ce qu'il a saisi de ce qu'une banque a proposé.
  "origine" text NOT NULL DEFAULT 'saisi'
    CHECK ("origine" IN ('saisi', 'reprise', 'banque')),

  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "paiements_facture_facture_idx" ON "paiements_facture" ("entreprise_id", "facture_id");
CREATE INDEX "paiements_facture_date_idx" ON "paiements_facture" ("entreprise_id", "date_paiement");

ALTER TABLE "paiements_facture" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paiements_facture" FORCE ROW LEVEL SECURITY;

CREATE POLICY "paiements_facture_isolation" ON "paiements_facture"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "paiements_facture" TO atlas_app;

-- =========================================================================
-- La reprise : le passé ne bouge pas
-- =========================================================================
--
-- Une ligne par facture déjà émise, à sa date d'émission, pour son TTC. Après
-- cette migration, tout relevé déjà consulté rend exactement les mêmes
-- montants, quel que soit le régime retenu.

INSERT INTO "paiements_facture" ("entreprise_id", "facture_id", "date_paiement", "montant", "origine")
SELECT "entreprise_id", "id", "date_emission", "total_ttc", 'reprise'
FROM "factures"
WHERE "statut" = 'emise' AND "total_ttc" > 0;
