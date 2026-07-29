ALTER TABLE "notes_vocales" ADD COLUMN "transcription_statut" text DEFAULT 'non_demandee' NOT NULL;
ALTER TABLE "notes_vocales" ADD COLUMN "transcription_erreur" text;
ALTER TABLE "notes_vocales" ADD CONSTRAINT notes_vocales_transcription_statut_valide
  CHECK (transcription_statut IN ('non_demandee', 'en_cours', 'reussie', 'echouee'));
