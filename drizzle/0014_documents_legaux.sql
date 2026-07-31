-- Documents légaux et preuve de leur acceptation (voir docs/RGPD.md §8).
--
-- Le contrat de sous-traitance de l'article 28 RGPD doit être accepté par
-- chaque artisan. L'article 28.9 admet l'écrit « y compris sous forme
-- électronique » : une acceptation en ligne suffit, à trois conditions —
-- un document DISTINCT, une acceptation EXPLICITE, et une PREUVE conservée.
-- Ces deux tables portent la troisième condition, qui est la seule dont le
-- code soit responsable.
--
-- Choix structurant : l'acceptation pointe vers une VERSION précise du texte,
-- dont on conserve l'empreinte SHA-256. Sans cela, on saurait qu'un artisan a
-- accepté « le contrat » sans pouvoir dire lequel — c'est-à-dire rien.
-- Une version publiée est donc immuable : corriger un texte, c'est en publier
-- une nouvelle version, jamais réécrire l'ancienne (les acceptations déjà
-- recueillies continuent de désigner ce qui a réellement été accepté).

CREATE TABLE "documents_legaux" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'sous_traitance' est le contrat de l'article 28 ; les deux autres
  -- l'accompagnent sans s'y substituer (§8 : un document distinct).
  "type" text NOT NULL CHECK ("type" IN ('cgu', 'sous_traitance', 'confidentialite')),
  "version" text NOT NULL,
  "titre" text NOT NULL,
  "contenu" text NOT NULL,
  -- Empreinte SHA-256 du contenu, en hexadécimal minuscule. Calculée à la
  -- publication et jamais recalculée : elle atteste du texte exact accepté.
  "empreinte" char(64) NOT NULL,
  -- Un document dont l'acceptation n'est pas exigée reste consultable mais ne
  -- bloque pas l'accès (permet de publier une note d'information sans
  -- interrompre le travail de tout le monde).
  "acceptation_requise" boolean NOT NULL DEFAULT true,
  "publie_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "documents_legaux_type_version_uk" UNIQUE ("type", "version")
);

CREATE INDEX "documents_legaux_type_publie_idx" ON "documents_legaux" ("type", "publie_at" DESC);

-- Pas de RLS : ce sont des textes publics, identiques pour tous les artisans,
-- et ils ne contiennent aucune donnée personnelle. En revanche l'application
-- ne peut que les LIRE — publier une version est une opération d'exploitation,
-- réservée au propriétaire du schéma (voir synchroniserDocumentsLegaux).
GRANT SELECT ON "documents_legaux" TO atlas_app;


CREATE TABLE "acceptations_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "utilisateur_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "documents_legaux"("id") ON DELETE RESTRICT,
  "accepte_at" timestamptz NOT NULL DEFAULT now(),
  -- Éléments de preuve. Nullables : une adresse ou un agent absent affaiblit la
  -- preuve mais ne doit jamais empêcher de consigner l'acceptation elle-même.
  "adresse_ip" text,
  "agent_utilisateur" text,
  -- Une acceptation ne se retire pas et ne se remplace pas : accepter une
  -- nouvelle version crée une nouvelle ligne, l'ancienne restant la preuve de
  -- ce qui valait auparavant.
  CONSTRAINT "acceptations_documents_uk" UNIQUE ("utilisateur_id", "document_id")
);

CREATE INDEX "acceptations_documents_utilisateur_idx"
  ON "acceptations_documents" ("utilisateur_id");

-- Donnée personnelle : chaque utilisateur ne voit que ses propres
-- acceptations. Le contexte est app.utilisateur_id — jamais app.entreprise_id,
-- car l'acceptation lie une PERSONNE, et parce qu'elle doit pouvoir être
-- recueillie avant même qu'une entreprise soit rattachée au compte.
ALTER TABLE "acceptations_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acceptations_documents" FORCE ROW LEVEL SECURITY;

CREATE POLICY "acceptations_documents_isolation" ON "acceptations_documents"
  USING ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid)
  WITH CHECK ("utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid);

-- Pas de DELETE : une preuve ne s'efface pas depuis l'application. L'effacement
-- d'un compte passe par la suppression de l'utilisateur (ON DELETE CASCADE),
-- opération d'exploitation tracée, jamais un geste d'interface.
GRANT SELECT, INSERT ON "acceptations_documents" TO atlas_app;
