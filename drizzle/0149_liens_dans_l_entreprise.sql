-- LES LIENS ENTRE TABLES NE TRAVERSENT PLUS LES ENTREPRISES (audit de
-- sécurité du 25 octobre 2026, E10).
--
-- Vingt-six clés étrangères reliaient deux tables d'entreprise par le seul
-- identifiant : un paiement à une facture, un acompte à un devis, une photo à
-- un retour... La RLS vérifie l'entreprise de la ligne écrite, jamais celle de
-- la ligne visée, et une clé étrangère se vérifie HORS de la RLS. Une écriture
-- qui recevrait l'identifiant d'une autre entreprise l'accepterait donc. Le
-- code ne le fait pas aujourd'hui : c'est la base qui le garantit désormais,
-- pour la porte que personne n'a encore écrite.
--
-- **Comment** : chaque table visée reçoit une unicité sur (id, entreprise_id),
-- et chaque lien une seconde clé, composite, à côté de l'ancienne (qui garde
-- son effacement en cascade ou à vide). La seconde n'agit qu'à l'écriture.
--
-- **NOT VALID, et c'est délibéré** (.claude/rules/migrations.md) : sur une
-- base habitée, valider d'un coup refuserait la migration entière au premier
-- lien ancien qui ne se lirait pas, et bloquerait les suivantes derrière elle
-- (la panne du 13 septembre 2026). Les lignes NEUVES sont vérifiées dès ce
-- soir ; la validation des anciennes se fera à part, une fois mesurée sur sa
-- base (TODO.md). Aucune donnée écrite : rien à voir sous FORCE RLS.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chantiers_id_entreprise_unique') THEN
    ALTER TABLE "chantiers" ADD CONSTRAINT "chantiers_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_id_entreprise_unique') THEN
    ALTER TABLE "clients" ADD CONSTRAINT "clients_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'devis_id_entreprise_unique') THEN
    ALTER TABLE "devis" ADD CONSTRAINT "devis_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diagnostics_id_entreprise_unique') THEN
    ALTER TABLE "diagnostics" ADD CONSTRAINT "diagnostics_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_id_entreprise_unique') THEN
    ALTER TABLE "documents" ADD CONSTRAINT "documents_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'envois_devis_id_entreprise_unique') THEN
    ALTER TABLE "envois_devis" ADD CONSTRAINT "envois_devis_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipes_id_entreprise_unique') THEN
    ALTER TABLE "equipes" ADD CONSTRAINT "equipes_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factures_id_entreprise_unique') THEN
    ALTER TABLE "factures" ADD CONSTRAINT "factures_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiches_securite_id_entreprise_unique') THEN
    ALTER TABLE "fiches_securite" ADD CONSTRAINT "fiches_securite_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mots_catalogue_id_entreprise_unique') THEN
    ALTER TABLE "mots_catalogue" ADD CONSTRAINT "mots_catalogue_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_vocales_id_entreprise_unique') THEN
    ALTER TABLE "notes_vocales" ADD CONSTRAINT "notes_vocales_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paiements_facture_id_entreprise_unique') THEN
    ALTER TABLE "paiements_facture" ADD CONSTRAINT "paiements_facture_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'passages_entretien_id_entreprise_unique') THEN
    ALTER TABLE "passages_entretien" ADD CONSTRAINT "passages_entretien_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_id_entreprise_unique') THEN
    ALTER TABLE "photos" ADD CONSTRAINT "photos_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_diagnostic_id_entreprise_unique') THEN
    ALTER TABLE "photos_diagnostic" ADD CONSTRAINT "photos_diagnostic_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retours_intervention_id_entreprise_unique') THEN
    ALTER TABLE "retours_intervention" ADD CONSTRAINT "retours_intervention_id_entreprise_unique" UNIQUE ("id", "entreprise_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membres_entreprise_salarie_id_meme_entreprise') THEN
    ALTER TABLE "membres_entreprise" ADD CONSTRAINT "membres_entreprise_salarie_id_meme_entreprise"
      FOREIGN KEY ("salarie_id", "entreprise_id") REFERENCES "equipes" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membres_entreprise_equipe_id_meme_entreprise') THEN
    ALTER TABLE "membres_entreprise" ADD CONSTRAINT "membres_entreprise_equipe_id_meme_entreprise"
      FOREIGN KEY ("equipe_id", "entreprise_id") REFERENCES "equipes" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fragments_documents_document_id_meme_entreprise') THEN
    ALTER TABLE "fragments_documents" ADD CONSTRAINT "fragments_documents_document_id_meme_entreprise"
      FOREIGN KEY ("document_id", "entreprise_id") REFERENCES "documents" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audios_a_purger_note_id_meme_entreprise') THEN
    ALTER TABLE "audios_a_purger" ADD CONSTRAINT "audios_a_purger_note_id_meme_entreprise"
      FOREIGN KEY ("note_id", "entreprise_id") REFERENCES "notes_vocales" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'absences_equipe_equipe_id_meme_entreprise') THEN
    ALTER TABLE "absences_equipe" ADD CONSTRAINT "absences_equipe_equipe_id_meme_entreprise"
      FOREIGN KEY ("equipe_id", "entreprise_id") REFERENCES "equipes" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paiements_facture_facture_id_meme_entreprise') THEN
    ALTER TABLE "paiements_facture" ADD CONSTRAINT "paiements_facture_facture_id_meme_entreprise"
      FOREIGN KEY ("facture_id", "entreprise_id") REFERENCES "factures" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mots_catalogue_parent_id_meme_entreprise') THEN
    ALTER TABLE "mots_catalogue" ADD CONSTRAINT "mots_catalogue_parent_id_meme_entreprise"
      FOREIGN KEY ("parent_id", "entreprise_id") REFERENCES "mots_catalogue" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'passages_entretien_client_id_meme_entreprise') THEN
    ALTER TABLE "passages_entretien" ADD CONSTRAINT "passages_entretien_client_id_meme_entreprise"
      FOREIGN KEY ("client_id", "entreprise_id") REFERENCES "clients" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lignes_passage_passage_id_meme_entreprise') THEN
    ALTER TABLE "lignes_passage" ADD CONSTRAINT "lignes_passage_passage_id_meme_entreprise"
      FOREIGN KEY ("passage_id", "entreprise_id") REFERENCES "passages_entretien" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_diagnostic_diagnostic_id_meme_entreprise') THEN
    ALTER TABLE "photos_diagnostic" ADD CONSTRAINT "photos_diagnostic_diagnostic_id_meme_entreprise"
      FOREIGN KEY ("diagnostic_id", "entreprise_id") REFERENCES "diagnostics" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hypotheses_diagnostic_diagnostic_id_meme_entreprise') THEN
    ALTER TABLE "hypotheses_diagnostic" ADD CONSTRAINT "hypotheses_diagnostic_diagnostic_id_meme_entreprise"
      FOREIGN KEY ("diagnostic_id", "entreprise_id") REFERENCES "diagnostics" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'photos_diagnostic_a_purger_photo_id_meme_entreprise') THEN
    ALTER TABLE "photos_diagnostic_a_purger" ADD CONSTRAINT "photos_diagnostic_a_purger_photo_id_meme_entreprise"
      FOREIGN KEY ("photo_id", "entreprise_id") REFERENCES "photos_diagnostic" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipes_du_chantier_equipe_id_meme_entreprise') THEN
    ALTER TABLE "equipes_du_chantier" ADD CONSTRAINT "equipes_du_chantier_equipe_id_meme_entreprise"
      FOREIGN KEY ("equipe_id", "entreprise_id") REFERENCES "equipes" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rappels_vus_chantier_id_meme_entreprise') THEN
    ALTER TABLE "rappels_vus" ADD CONSTRAINT "rappels_vus_chantier_id_meme_entreprise"
      FOREIGN KEY ("chantier_id", "entreprise_id") REFERENCES "chantiers" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retours_intervention_chantier_id_meme_entreprise') THEN
    ALTER TABLE "retours_intervention" ADD CONSTRAINT "retours_intervention_chantier_id_meme_entreprise"
      FOREIGN KEY ("chantier_id", "entreprise_id") REFERENCES "chantiers" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retours_intervention_taches_retour_id_meme_entreprise') THEN
    ALTER TABLE "retours_intervention_taches" ADD CONSTRAINT "retours_intervention_taches_retour_id_meme_entreprise"
      FOREIGN KEY ("retour_id", "entreprise_id") REFERENCES "retours_intervention" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retours_intervention_photos_retour_id_meme_entreprise') THEN
    ALTER TABLE "retours_intervention_photos" ADD CONSTRAINT "retours_intervention_photos_retour_id_meme_entreprise"
      FOREIGN KEY ("retour_id", "entreprise_id") REFERENCES "retours_intervention" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retours_intervention_photos_photo_id_meme_entreprise') THEN
    ALTER TABLE "retours_intervention_photos" ADD CONSTRAINT "retours_intervention_photos_photo_id_meme_entreprise"
      FOREIGN KEY ("photo_id", "entreprise_id") REFERENCES "photos" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'retours_intervention_vus_retour_id_meme_entreprise') THEN
    ALTER TABLE "retours_intervention_vus" ADD CONSTRAINT "retours_intervention_vus_retour_id_meme_entreprise"
      FOREIGN KEY ("retour_id", "entreprise_id") REFERENCES "retours_intervention" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creneaux_chantier_chantier_id_meme_entreprise') THEN
    ALTER TABLE "creneaux_chantier" ADD CONSTRAINT "creneaux_chantier_chantier_id_meme_entreprise"
      FOREIGN KEY ("chantier_id", "entreprise_id") REFERENCES "chantiers" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acomptes_devis_devis_id_meme_entreprise') THEN
    ALTER TABLE "acomptes_devis" ADD CONSTRAINT "acomptes_devis_devis_id_meme_entreprise"
      FOREIGN KEY ("devis_id", "entreprise_id") REFERENCES "devis" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiches_securite_chantier_id_meme_entreprise') THEN
    ALTER TABLE "fiches_securite" ADD CONSTRAINT "fiches_securite_chantier_id_meme_entreprise"
      FOREIGN KEY ("chantier_id", "entreprise_id") REFERENCES "chantiers" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiches_securite_photos_fiche_id_meme_entreprise') THEN
    ALTER TABLE "fiches_securite_photos" ADD CONSTRAINT "fiches_securite_photos_fiche_id_meme_entreprise"
      FOREIGN KEY ("fiche_id", "entreprise_id") REFERENCES "fiches_securite" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiches_securite_photos_photo_id_meme_entreprise') THEN
    ALTER TABLE "fiches_securite_photos" ADD CONSTRAINT "fiches_securite_photos_photo_id_meme_entreprise"
      FOREIGN KEY ("photo_id", "entreprise_id") REFERENCES "photos" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acceptations_defaites_envoi_id_meme_entreprise') THEN
    ALTER TABLE "acceptations_defaites" ADD CONSTRAINT "acceptations_defaites_envoi_id_meme_entreprise"
      FOREIGN KEY ("envoi_id", "entreprise_id") REFERENCES "envois_devis" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'virements_recus_paiement_id_meme_entreprise') THEN
    ALTER TABLE "virements_recus" ADD CONSTRAINT "virements_recus_paiement_id_meme_entreprise"
      FOREIGN KEY ("paiement_id", "entreprise_id") REFERENCES "paiements_facture" ("id", "entreprise_id") NOT VALID;
  END IF;
END $$;
