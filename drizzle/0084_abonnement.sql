-- L'ABONNEMENT — « et que si on clique sur s'abonner qu'on puisse payer, mets
-- tout le système en place » (9 septembre 2026), puis « fais-moi Stripe ».
--
-- Les trois formules et leurs prix vivent dans `src/lib/abonnements.ts`, pas
-- ici : un prix en base se retouche à la main un soir de fatigue, et plus rien
-- ne dit alors ce que l'écran affiche. La base ne garde que ce qui appartient
-- à CETTE entreprise-là — ce qu'elle a choisi, et où en est son paiement.
--
-- ════════════════════════════════════════════════════════════════════════════
-- POURQUOI L'ÉTAT VIT CHEZ NOUS ALORS QUE STRIPE LE CONNAÎT DÉJÀ.
--
-- Interroger Stripe à chaque affichage mettrait un appel réseau — et une panne
-- possible — entre le patron et son écran de réglages. Pire : le jour où
-- Stripe est injoignable, Atlas ne saurait plus qui est abonné. L'état est
-- donc recopié ici à chaque notification, et Stripe reste la source : en cas
-- de désaccord, c'est lui qui a raison, et le crochet le réécrit au prochain
-- événement.
--
-- ════════════════════════════════════════════════════════════════════════════
-- IL N'Y A PAS D'ÉTAT « ESSAI », ET CE N'EST PAS UN OUBLI.
--
-- La durée de l'essai gratuit est l'une des seize cases [À COMPLÉTER] des
-- conditions générales (version 2, `src/server/documents-legaux/versions.ts`) :
-- elle n'est pas arrêtée. L'écrire ici en aurait fait un engagement décidé par
-- le code. La contrainte CHECK ci-dessous refusera donc « essai » tant que la
-- migration qui l'ajoute n'aura pas été écrite — et c'est voulu : mieux vaut
-- un refus franc qu'une valeur qui dort.

CREATE TABLE "abonnements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  "formule" text NOT NULL,
  "periodicite" text NOT NULL,
  "statut" text NOT NULL,

  -- Jusqu'à quand la période payée court. NULL tant que le prestataire ne l'a
  -- pas dit : afficher une date devinée sur un écran de paiement ferait
  -- attendre un prélèvement le mauvais jour.
  "periode_fin" timestamptz,

  -- **Résilier ne coupe rien tout de suite.** Il a payé jusqu'au bout de la
  -- période ; l'abonnement reste « actif » et cette colonne dit qu'il ne sera
  -- pas reconduit. C'est aussi ce que l'article 14.4 des conditions annonce.
  "annulation_demandee" boolean NOT NULL DEFAULT false,

  -- Les identifiants du prestataire. Nommés « prestataire » et non « stripe » :
  -- le jour où l'on en change, c'est le contenu qui change, pas le schéma —
  -- et le nom d'un fournisseur dans une colonne finit toujours par mentir.
  "client_prestataire" text,
  "abonnement_prestataire" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Une valeur inconnue vaut un refus, jamais un repli silencieux : c'est la
  -- règle d'`env.ts` sur NODE_ENV, et elle vaut d'autant plus ici que la
  -- colonne décide de ce qu'on facture.
  CONSTRAINT "abonnements_formule_connue"
    CHECK ("formule" IN ('artisan', 'entreprise', 'illimite')),
  CONSTRAINT "abonnements_periodicite_connue"
    CHECK ("periodicite" IN ('mensuelle', 'annuelle')),
  CONSTRAINT "abonnements_statut_connu"
    CHECK ("statut" IN ('actif', 'impaye', 'resilie'))
);

-- **UN SEUL ABONNEMENT PAR ENTREPRISE.** Deux lignes — un double appui sur
-- « S'abonner », deux onglets ouverts — donneraient deux prélèvements et deux
-- plafonds contradictoires, et rien ne dirait lequel fait foi.
CREATE UNIQUE INDEX "abonnements_entreprise_uk" ON "abonnements" ("entreprise_id");

-- Par où le crochet retrouve l'entreprise : il ne connaît que l'identifiant de
-- l'abonnement chez le prestataire. Unique, parce que le même abonnement ne
-- peut pas appartenir à deux entreprises — et si cela arrivait, c'est une
-- erreur qu'on veut voir à l'écriture, pas découvrir en cherchant qui débiter.
CREATE UNIQUE INDEX "abonnements_prestataire_uk"
  ON "abonnements" ("abonnement_prestataire")
  WHERE "abonnement_prestataire" IS NOT NULL;

ALTER TABLE "abonnements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "abonnements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "abonnements_isolation" ON "abonnements"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- ════════════════════════════════════════════════════════════════════════════
-- LA SERRURE DU CROCHET — et pourquoi ce n'est PAS un affaiblissement de la RLS.
--
-- Stripe frappe sans session : il n'y a ni utilisateur, ni entreprise, donc
-- l'isolation ci-dessus ne peut pas s'appliquer. La tentation serait de faire
-- tourner le crochet sous un rôle qui traverse la RLS ; `CLAUDE.md` §4
-- l'interdit, et à raison — ce serait un rôle privilégié derrière une adresse
-- publique.
--
-- La même serrure que la page publique d'une facture est employée : une
-- politique qui exige, mot pour mot, l'identifiant d'abonnement posé par le
-- code juste avant la requête (migration 0081, `envois_factures_reception_par_jeton`).
-- Sans lui, aucune ligne n'est visible ni modifiable, et aucune énumération
-- n'est possible. Les politiques PERMISSIVE se combinent en OR : celle-ci
-- s'ajoute à l'isolation, elle ne la remplace pas.
--
-- **Ce qui rend la serrure sûre, c'est ce qui la précède** : l'identifiant
-- n'est posé qu'après que la SIGNATURE de l'événement a été vérifiée
-- (`src/lib/signature-stripe.ts`). Un identifiant deviné ne sert donc à rien —
-- il faudrait d'abord savoir signer comme Stripe.
CREATE POLICY "abonnements_par_identifiant_prestataire" ON "abonnements"
  USING ("abonnement_prestataire" = NULLIF(current_setting('app.abonnement_prestataire', true), ''))
  WITH CHECK ("abonnement_prestataire" = NULLIF(current_setting('app.abonnement_prestataire', true), ''));

-- ════════════════════════════════════════════════════════════════════════════
-- CE QUI EMPÊCHE DE COMPTER DEUX FOIS LE MÊME ÉVÉNEMENT.
--
-- Stripe RÉPÈTE ses notifications tant qu'il n'a pas reçu un 200 — c'est une
-- garantie « au moins une fois », jamais « exactement une fois ». Un réseau
-- lent, et le même « paiement reçu » arrive trois fois. Sans cette table, une
-- entreprise pourrait voir sa période prolongée trois fois d'un seul paiement.
--
-- Chaque ligne porte son entreprise : rien dans ce dépôt ne vit hors d'une
-- entreprise, et une table sans isolation deviendrait le premier endroit où
-- l'on regarde le jour d'une fuite.
CREATE TABLE "evenements_paiement" (
  -- L'identifiant que le prestataire donne à l'événement (« evt_… ») : c'est
  -- lui la clé, et c'est ce qui rend le traitement idempotent.
  "id" text PRIMARY KEY,
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "recu_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "evenements_paiement_entreprise_idx"
  ON "evenements_paiement" ("entreprise_id", "recu_at" DESC);

ALTER TABLE "evenements_paiement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evenements_paiement" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evenements_paiement_isolation" ON "evenements_paiement"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Aucun GRANT ici, et ce n'est pas un oubli : `ALTER DEFAULT PRIVILEGES FOR
-- ROLE atlas_owner` (scripts/bootstrap-postgres-ci.sql) donne déjà SELECT,
-- INSERT, UPDATE et DELETE à `atlas_app` sur toute table créée ensuite. Le
-- vérifier plutôt que le supposer :
--   SELECT privilege_type FROM information_schema.role_table_grants
--    WHERE grantee='atlas_app' AND table_name='abonnements';
