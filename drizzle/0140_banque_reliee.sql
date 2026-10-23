-- MA BANQUE, LA SUITE — ses choix du 23 octobre 2026, planches
-- `appli/banque-a-essayer.html`, `appli/banque-numero-et-termines.html` (A) et
-- `appli/banque-virement-en-couleur.html` (A).
--
-- L'essai du 22 octobre gardait la liaison bancaire dans un témoin du
-- navigateur et ne retenait rien. Pour qu'un virement devienne une carte sur
-- l'accueil ET une question dans Ma TVA, et qu'un « oui » donné à un endroit
-- vaille pour l'autre, il faut deux choses en base :
--
--   · la LIAISON de l'entreprise à sa banque, et la date où l'accord finit ;
--   · les VIREMENTS REÇUS, chacun avec la réponse du patron.
--
-- **La proposition n'est PAS stockée** : elle se recalcule à chaque lecture
-- (`src/lib/rapprochement-bancaire.ts`), contre les factures en attente du
-- moment. Stockée, elle désignerait encore une facture soldée entre-temps.
--
-- Expand seul : deux tables neuves, aucune ligne existante touchée.

CREATE TABLE IF NOT EXISTS "liaisons_bancaires" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- Un seul prestataire aujourd'hui ; la colonne dit lequel a ouvert la session,
  -- pour le jour où il en changera (`docs/A-FAIRE.md` §13).
  "prestataire" text NOT NULL DEFAULT 'enable_banking' CHECK ("prestataire" IN ('enable_banking')),
  -- La session ouverte chez le prestataire. Elle ne vaut rien sans la clé de
  -- l'application, qui ne quitte pas le serveur : c'est elle qui signe.
  "session_id" text NOT NULL CHECK (length(btrim("session_id")) > 0),
  "comptes" text[] NOT NULL CHECK (cardinality("comptes") > 0),
  "banque" text,
  -- La fin de l'accord donné à la banque : l'accueil prévient sept jours avant.
  "accord_jusqu_au" timestamptz NOT NULL,
  -- La dernière lecture : on ne relit pas la banque plus d'une fois par
  -- demi-heure (les banques limitent les lectures sans le patron devant).
  "lu_le" timestamptz,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- Une banque reliée par entreprise : relier à nouveau remplace.
  CONSTRAINT "liaisons_bancaires_une_par_entreprise" UNIQUE ("entreprise_id")
);

CREATE TABLE IF NOT EXISTS "virements_recus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- Ce qui reconnaît un virement d'une lecture à l'autre : la référence de la
  -- banque, ou à défaut une empreinte de ce qu'elle montre. Lire deux fois ne
  -- double rien (index unique ci-dessous).
  "cle" text NOT NULL CHECK (length(btrim("cle")) > 0),
  "jour" date NOT NULL,
  "montant" numeric(12, 2) NOT NULL CHECK ("montant" > 0),
  "payeur" text,
  "libelle" text NOT NULL DEFAULT '',
  -- `nouveau` : pas encore de réponse · `confirme` : il a dit oui, un paiement
  -- est noté · `ecarte` : il a dit non.
  "etat" text NOT NULL DEFAULT 'nouveau' CHECK ("etat" IN ('nouveau', 'confirme', 'ecarte')),
  -- La facture à laquelle il a dit oui, et le règlement que ce oui a noté :
  -- c'est ce qui permet d'annuler.
  "facture_id" uuid,
  -- Le règlement n'est jamais choisi par le navigateur : il naît dans la même
  -- transaction que le oui. S'il est retiré depuis Ma TVA, le lien s'efface.
  "paiement_id" uuid REFERENCES "paiements_facture"("id") ON DELETE SET NULL,
  "repondu_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  -- **La facture de la MÊME entreprise**, par la clé double : un identifiant
  -- d'une autre entreprise ne peut pas s'y glisser, même tapé à la main.
  CONSTRAINT "virements_recus_facture_fk" FOREIGN KEY ("facture_id", "entreprise_id")
    REFERENCES "factures"("id", "entreprise_id") ON DELETE SET NULL ("facture_id"),
  CONSTRAINT "virements_recus_oui_a_une_facture" CHECK ("etat" <> 'confirme' OR "facture_id" IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS "virements_recus_cle_uk" ON "virements_recus" ("entreprise_id", "cle");
CREATE INDEX IF NOT EXISTS "virements_recus_nouveaux_idx" ON "virements_recus" ("entreprise_id", "jour") WHERE "etat" = 'nouveau';

ALTER TABLE "liaisons_bancaires" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "liaisons_bancaires" FORCE ROW LEVEL SECURITY;
CREATE POLICY "liaisons_bancaires_isolation" ON "liaisons_bancaires"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "liaisons_bancaires" TO atlas_app;

ALTER TABLE "virements_recus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "virements_recus" FORCE ROW LEVEL SECURITY;
CREATE POLICY "virements_recus_isolation" ON "virements_recus"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "virements_recus" TO atlas_app;
