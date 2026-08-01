-- Cycle d'envoi du devis au client et de sa réponse (voir docs/AGENT.md §2.1
-- à §2.3).
--
-- Une ligne par ENVOI, jamais par devis : un devis refusé puis corrigé et
-- renvoyé donne un nouvel envoi, avec un nouveau jeton. L'ancien reste en base
-- comme trace de ce qui avait été proposé et de la réponse obtenue — un refus
-- est une information de négociation, il ne s'efface pas.

CREATE TABLE "envois_devis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL,
  "devis_id" uuid NOT NULL,

  -- Jeton du lien envoyé au client. C'est la SEULE clé d'accès à la page
  -- publique : il doit être imprévisible (256 bits d'aléa) et n'est jamais
  -- dérivé d'un identifiant existant, sous peine de rendre les autres devis
  -- devinables à partir d'un seul lien.
  "jeton" text NOT NULL,

  -- Un lien qui traîne indéfiniment dans un téléphone est une fuite qui attend
  -- son heure. Passée cette date, la page ne répond plus.
  "expire_at" timestamptz NOT NULL,

  "canal" text NOT NULL CHECK ("canal" IN ('sms', 'email')),

  -- Une ou deux dates, jamais zéro, jamais trois : le patron tranche la forme
  -- au moment de la validation du devis (docs/AGENT.md §2.2).
  "dates_proposees" date[] NOT NULL
    CHECK (array_length("dates_proposees", 1) BETWEEN 1 AND 2),

  -- Empreinte SHA-256 du devis exact envoyé. Comme pour les documents légaux,
  -- c'est elle qui donne sa valeur à l'acceptation : le client n'accepte pas
  -- « le devis », il accepte CE devis-là.
  "empreinte_devis" char(64) NOT NULL,

  "envoye_at" timestamptz NOT NULL DEFAULT now(),

  -- --- Réponse du client (tout NULL tant qu'il n'a pas répondu) ---
  "reponse" text CHECK ("reponse" IN ('acceptee', 'refusee')),
  "repondu_at" timestamptz,

  -- Date effectivement retenue : l'une des dates proposées, ou celle que le
  -- client a lui-même choisie dans le calendrier (contre-proposition).
  "date_retenue" date,
  -- Distingue une contre-proposition d'un choix parmi les dates offertes, sans
  -- avoir à recomparer les tableaux après coup.
  "date_contre_proposee" boolean NOT NULL DEFAULT false,
  -- Ce qui n'est pas une date : « plutôt le matin », « pas avant 9 h ».
  "precision_client" text,

  -- Demande expresse de démarrage avant la fin du délai de rétractation de
  -- 14 jours. Conservée avec l'acceptation : c'est elle, et elle seule, qui
  -- autorise le patron à intervenir plus tôt.
  "demarrage_anticipe" boolean NOT NULL DEFAULT false,

  -- Éléments de preuve de l'acceptation, au même titre que pour les documents
  -- légaux : ce qui fait la valeur d'un accord en ligne, c'est sa trace.
  "adresse_ip" text,
  "agent_utilisateur" text,

  -- Le patron a-t-il pris connaissance de la réponse ? Sert à la notification
  -- « devis retourné » et à celle d'une date contre-proposée.
  "vu_par_patron_at" timestamptz,

  CONSTRAINT "envois_devis_jeton_uk" UNIQUE ("jeton"),

  -- Cohérence : une réponse est datée, et une acceptation retient une date.
  CONSTRAINT "envois_devis_reponse_datee" CHECK (
    ("reponse" IS NULL AND "repondu_at" IS NULL)
    OR ("reponse" IS NOT NULL AND "repondu_at" IS NOT NULL)
  ),
  CONSTRAINT "envois_devis_acceptation_a_une_date" CHECK (
    "reponse" IS DISTINCT FROM 'acceptee' OR "date_retenue" IS NOT NULL
  ),

  CONSTRAINT "envois_devis_chantier_entreprise_fk"
    FOREIGN KEY ("chantier_id", "entreprise_id")
    REFERENCES "chantiers"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "envois_devis_devis_entreprise_fk"
    FOREIGN KEY ("devis_id", "entreprise_id")
    REFERENCES "devis"("id", "entreprise_id") ON DELETE CASCADE
);

CREATE INDEX "envois_devis_entreprise_chantier_idx"
  ON "envois_devis" ("entreprise_id", "chantier_id");

-- Sert la liste « en attente de réponse » : les envois sans réponse, du plus
-- ancien au plus récent.
CREATE INDEX "envois_devis_en_attente_idx"
  ON "envois_devis" ("entreprise_id", "envoye_at")
  WHERE "reponse" IS NULL;

ALTER TABLE "envois_devis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envois_devis" FORCE ROW LEVEL SECURITY;

CREATE POLICY "envois_devis_isolation" ON "envois_devis"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- La page publique est consultée SANS session, donc sans entreprise_id connu :
-- la politique ci-dessus ne peut pas s'y appliquer. On ouvre une lecture
-- strictement limitée à un jeton exact, positionné par le code juste avant la
-- requête. Aucune énumération n'est possible — sans le jeton, aucune ligne.
-- Les politiques PERMISSIVE se combinent en OR : celle-ci s'ajoute, elle
-- n'affaiblit pas la précédente.
CREATE POLICY "envois_devis_lecture_par_jeton" ON "envois_devis"
  FOR SELECT
  USING ("jeton" = NULLIF(current_setting('app.jeton_envoi', true), ''));

-- Même logique pour l'écriture de la réponse : le client répond sans session.
CREATE POLICY "envois_devis_reponse_par_jeton" ON "envois_devis"
  FOR UPDATE
  USING ("jeton" = NULLIF(current_setting('app.jeton_envoi', true), ''))
  WITH CHECK ("jeton" = NULLIF(current_setting('app.jeton_envoi', true), ''));

GRANT SELECT, INSERT, UPDATE ON "envois_devis" TO atlas_app;


-- Canal convenu avec le client pour l'envoi (docs/AGENT.md §2.1). Nullable :
-- les clients existants n'en ont pas, et l'envoi est simplement impossible
-- tant qu'il n'est pas renseigné — mieux vaut bloquer qu'envoyer dans le vide.
ALTER TABLE "clients"
  ADD COLUMN "canal_communication" text
  CHECK ("canal_communication" IN ('sms', 'email'));


-- Jalons de fin de chantier (docs/AGENT.md §2.3). NULL = étape non atteinte,
-- comme les autres jalons de la table.
ALTER TABLE "chantiers" ADD COLUMN "termine_at" timestamptz;
ALTER TABLE "chantiers" ADD COLUMN "facture_envoyee_at" timestamptz;

-- Sert l'onglet « Chantiers terminés », rangé par date.
CREATE INDEX "chantiers_entreprise_termine_idx"
  ON "chantiers" ("entreprise_id", "termine_at" DESC)
  WHERE "termine_at" IS NOT NULL;
