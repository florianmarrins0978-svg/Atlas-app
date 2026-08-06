-- Transmettre la facture au client, comme on transmet le devis.
--
-- Le patron, le 6 août 2026, devant sa facture arrêtée : « la facture s'affiche
-- partie, mais le client ne la reçoit pas ». Il avait raison au mot près — rien
-- n'était prévu pour qu'elle lui parvienne. L'écran disait « arrêtée », ce qui
-- est vrai comptablement, et le laissait croire à un envoi qui n'existait pas.
--
-- Aucun prestataire n'envoie à la place du patron : c'est tranché depuis le
-- 4 août 2026 (`docs/A-FAIRE.md` §5). La facture part donc de SA messagerie,
-- comme le devis — d'où un lien public, et donc un jeton.
--
-- Volontairement plus simple que `envois_devis` : une facture ne se négocie
-- pas. Pas de dates proposées, pas de réponse, pas d'acceptation à tracer. Un
-- lien, une date d'expiration, et la trace de ce qui est parti.

CREATE TABLE "envois_factures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "facture_id" uuid NOT NULL,

  -- Même exigence que pour le devis : 256 bits d'aléa, jamais dérivé d'un
  -- identifiant existant, sous peine de rendre les autres factures devinables
  -- à partir d'un seul lien.
  "jeton" text NOT NULL,

  -- Un lien qui traîne indéfiniment dans un téléphone est une fuite qui attend
  -- son heure. Une facture se règle sous trente jours ; le lien vit plus
  -- longtemps que le délai, pas éternellement.
  "expire_at" timestamptz NOT NULL,

  "canal" text NOT NULL CHECK ("canal" IN ('sms', 'email')),
  "envoye_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "envois_factures_jeton_uk" UNIQUE ("jeton"),
  CONSTRAINT "envois_factures_facture_entreprise_fk"
    FOREIGN KEY ("facture_id", "entreprise_id")
    REFERENCES "factures"("id", "entreprise_id") ON DELETE CASCADE
);

CREATE INDEX "envois_factures_entreprise_facture_idx"
  ON "envois_factures" ("entreprise_id", "facture_id");

ALTER TABLE "envois_factures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envois_factures" FORCE ROW LEVEL SECURITY;

CREATE POLICY "envois_factures_isolation" ON "envois_factures"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Le client ouvre sa facture SANS session, donc sans entreprise_id connu : la
-- politique ci-dessus ne peut pas s'y appliquer. Lecture strictement limitée à
-- un jeton exact, posé par le code juste avant la requête. Sans le jeton,
-- aucune ligne — aucune énumération possible.
CREATE POLICY "envois_factures_lecture_par_jeton" ON "envois_factures"
  FOR SELECT
  USING ("jeton" = NULLIF(current_setting('app.jeton_envoi', true), ''));

GRANT SELECT, INSERT ON "envois_factures" TO atlas_app;
