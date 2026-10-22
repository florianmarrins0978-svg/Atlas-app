-- IMPORTER DEVIS ET FACTURES — sa demande du 22 octobre 2026, maquette
-- `appli/importer-ancienne-appli.html`, mesures et décisions dans
-- `docs/importer-devis-factures.md`.
--
-- Un artisan qui arrive d'un autre logiciel (ou qui n'en avait pas) dépose ses
-- PDF, d'un coup ou un par un. Atlas lit chaque pièce, retrouve ou crée le
-- client, et la range sur sa fiche.
--
-- **UNE PIÈCE IMPORTÉE N'EST NI UN DEVIS NI UNE FACTURE D'ATLAS.** Elle vit
-- dans sa propre table, à côté de `devis` et de `factures`, et c'est ce qui
-- la tient hors du relevé de TVA (déjà déclarée par l'ancien logiciel), hors
-- de la numérotation (une suite qui reprendrait les numéros d'un autre
-- logiciel se casserait) et hors de toute modification : son fichier est
-- gardé tel qu'il est arrivé.
--
-- Expand seul : deux tables neuves, aucune ligne existante touchée.

-- Un envoi : ce qu'il a choisi d'un coup (un zip, ou quelques PDF).
CREATE TABLE IF NOT EXISTS "envois_pieces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  -- Le nom de ce qu'il a choisi (« Années 2022 à 2024.zip »), pour le lui redire.
  "nom" text NOT NULL CHECK (length(btrim("nom")) > 0),
  -- Combien de pièces il annonçait : la bande « 312 sur 1 450 » lit ce chiffre.
  "attendues" integer NOT NULL CHECK ("attendues" > 0 AND "attendues" <= 2000),
  -- Le dernier rangement, pour pouvoir l'annuler : les clients qu'il a créés.
  "clients_crees" uuid[] NOT NULL DEFAULT '{}',
  "range_le" timestamptz,
  "created_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "envois_pieces_id_entreprise_uk" UNIQUE ("id", "entreprise_id")
);
CREATE INDEX IF NOT EXISTS "envois_pieces_entreprise_idx" ON "envois_pieces" ("entreprise_id", "created_at");

CREATE TABLE IF NOT EXISTS "pieces_importees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "envoi_id" uuid NOT NULL,
  -- SHA-256 du fichier tel qu'il est arrivé : importer deux fois le même zip
  -- ne double rien (index unique ci-dessous).
  "empreinte" text NOT NULL CHECK ("empreinte" ~ '^[0-9a-f]{64}$'),
  "fichier_cle" text NOT NULL,
  "fichier_nom" text,
  -- `a_lire` : déposée, pas encore lue · `en_lecture` : un serveur la lit ·
  -- `lue` : genre et client trouvés · `a_verifier` : il manque le client ·
  -- `rangee` : rattachée à un client.
  "statut" text NOT NULL DEFAULT 'a_lire'
    CHECK ("statut" IN ('a_lire', 'en_lecture', 'lue', 'a_verifier', 'rangee')),
  "lecture_commencee_le" timestamptz,
  -- Ce que la lecture a trouvé. Tout est facultatif : ce qui n'a pas été lu
  -- reste vide plutôt que d'être deviné (`docs/AGENT.md` §3).
  "genre" text CHECK ("genre" IN ('devis', 'facture')),
  "numero" text,
  "jour" date,
  "montant_ttc" numeric(12, 2),
  "nom_lu" text,
  "client_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pieces_importees_envoi_fk" FOREIGN KEY ("envoi_id", "entreprise_id")
    REFERENCES "envois_pieces"("id", "entreprise_id") ON DELETE CASCADE,
  -- **SET NULL et non CASCADE** : une facture se garde dix ans, même quand la
  -- fiche du client part ; son nom reste écrit dans le fichier.
  CONSTRAINT "pieces_importees_client_fk" FOREIGN KEY ("client_id", "entreprise_id")
    REFERENCES "clients"("id", "entreprise_id") ON DELETE SET NULL ("client_id"),
  CONSTRAINT "pieces_importees_rangee_a_un_client" CHECK ("statut" <> 'rangee' OR "client_id" IS NOT NULL OR "nom_lu" IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS "pieces_importees_empreinte_uk" ON "pieces_importees" ("entreprise_id", "empreinte");
CREATE INDEX IF NOT EXISTS "pieces_importees_envoi_idx" ON "pieces_importees" ("envoi_id", "statut");
CREATE INDEX IF NOT EXISTS "pieces_importees_client_idx" ON "pieces_importees" ("client_id") WHERE "client_id" IS NOT NULL;

ALTER TABLE "envois_pieces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envois_pieces" FORCE ROW LEVEL SECURITY;
CREATE POLICY "envois_pieces_isolation" ON "envois_pieces"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "envois_pieces" TO atlas_app;

ALTER TABLE "pieces_importees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pieces_importees" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pieces_importees_isolation" ON "pieces_importees"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "pieces_importees" TO atlas_app;

COMMENT ON TABLE "envois_pieces" IS 'Un envoi de devis et factures importés : un zip ou quelques PDF (22 octobre 2026).';
COMMENT ON TABLE "pieces_importees" IS 'Devis et factures importés, gardés tels quels, hors TVA et hors numérotation (22 octobre 2026).';
