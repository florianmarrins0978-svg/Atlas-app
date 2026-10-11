-- LES DATES DU MOIS, VALIDÉES PAR LE CLIENT.
--
-- Sa demande du 27 septembre 2026, planche 130
-- (`appli/contrat-dates-du-mois.html`) : *« quand je veux le placer sur le
-- planning, il faudrait que je puisse lui envoyer le lien pour qu'il valide la
-- date, comme lorsque j'envoie un devis seul. Tous les 20 du mois, j'envoie
-- pour le mois suivant. »*
--
-- **UNE LIGNE PAR CONTRAT ET PAR MOIS**, jamais par passage : le client reçoit
-- toutes ses dates d'un coup, pas un SMS par tonte. L'unicité (contrat, mois)
-- rend l'envoi idempotent : un second appui renvoie le MÊME lien.
--
-- **Les dates ne vivent pas ici.** Elles sont celles des passages posés au
-- planning (`chantiers.date_planifiee` et ses créneaux) : les recopier ferait
-- deux vérités, et c'est le planning qui fait foi. Sans réponse, chaque date
-- tient jusqu'au jour prévu (sa décision du 27 septembre) : rien ne bascule.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : une table neuve,
-- aucune ligne existante touchée, aucun UPDATE sous FORCE RLS.

CREATE TABLE "envois_dates_contrat" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "contrat_entretien_id" uuid NOT NULL,
  -- Le premier jour du mois envoyé.
  "mois" date NOT NULL CHECK (EXTRACT(DAY FROM "mois") = 1),
  "jeton" text NOT NULL UNIQUE,
  "canal" text NOT NULL CHECK ("canal" IN ('sms', 'email')),
  -- Le même réglage que le devis, allumé d'office comme lui (0054) : figé à
  -- l'envoi, pour que la page du client dise demain ce qu'elle dit aujourd'hui.
  "autre_date_autorisee" boolean NOT NULL DEFAULT true,
  "envoye_le" timestamptz NOT NULL DEFAULT now(),
  "repondu_le" timestamptz,
  "reponse_adresse_ip" text,
  "reponse_agent" text,

  CONSTRAINT "envois_dates_contrat_contrat_fk"
    FOREIGN KEY ("contrat_entretien_id", "entreprise_id")
    REFERENCES "contrats_entretien"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "envois_dates_contrat_mois_uk" UNIQUE ("contrat_entretien_id", "mois")
);

CREATE INDEX "envois_dates_contrat_entreprise_idx" ON "envois_dates_contrat" ("entreprise_id", "mois");

ALTER TABLE "envois_dates_contrat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "envois_dates_contrat" FORCE ROW LEVEL SECURITY;

CREATE POLICY "envois_dates_contrat_isolation" ON "envois_dates_contrat"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- La lecture publique, par un jeton exact et rien d'autre : la mécanique du
-- contrat (0107) et du devis (0015). La réponse s'écrit ensuite sous le
-- contexte de l'entreprise que la ligne désigne.
CREATE POLICY "envois_dates_contrat_lecture_par_jeton" ON "envois_dates_contrat"
  FOR SELECT
  USING ("jeton" = NULLIF(current_setting('app.jeton_dates', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON "envois_dates_contrat" TO atlas_app;
