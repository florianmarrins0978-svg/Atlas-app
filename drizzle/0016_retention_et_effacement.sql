-- Durées de conservation et effacement d'un client (voir docs/RGPD.md §4 et §5).
--
-- Deux écarts constatés y sont comblés : rien n'était jamais effacé, et un
-- client ne pouvait obtenir ni ses données ni leur suppression.

-- --- Purge de l'audio une fois la transcription obtenue -------------------
--
-- L'audio est la donnée la plus sensible du produit : dicté librement sur un
-- chantier, il peut capter des propos qui n'ont rien à y faire. Une fois la
-- transcription obtenue et vérifiée, il ne sert plus à rien — le conserver
-- n'apporte aucune fonctionnalité et allonge indéfiniment l'exposition.
--
-- `storage_key` devient donc annulable : la note vocale survit à son audio,
-- avec sa transcription. La distinction compte pour l'interface, qui doit
-- pouvoir dire « transcription disponible, enregistrement effacé » plutôt que
-- de laisser croire à une perte de données.
ALTER TABLE "notes_vocales" ALTER COLUMN "storage_key" DROP NOT NULL;

-- Date de purge de l'audio. NULL = audio encore présent. Renseignée, elle
-- atteste que l'effacement a bien eu lieu et quand — une purge sans trace ne
-- se prouve pas.
ALTER TABLE "notes_vocales" ADD COLUMN "audio_purge_le" timestamptz;

CREATE INDEX "notes_vocales_audio_a_purger_idx"
  ON "notes_vocales" ("entreprise_id", "updated_at")
  WHERE "storage_key" IS NOT NULL AND "transcription" IS NOT NULL;


-- --- Effacement d'un client ------------------------------------------------
--
-- Un client effacé n'est pas une ligne supprimée. Certaines pièces doivent
-- légalement survivre — une facture se conserve dix ans (Code de commerce
-- L123-22), et une facture sans nom de client n'est pas une facture valable.
-- L'effacement retire donc ce qui peut l'être et conserve ce que la loi impose,
-- en marquant clairement la différence.
ALTER TABLE "clients" ADD COLUMN "efface_le" timestamptz;

-- Motif de conservation, quand des pièces subsistent après effacement. Sert la
-- réponse à faire à la personne : « voici ce qui reste, et pourquoi ». Un
-- effacement qui tairait ce qu'il conserve serait un mensonge.
ALTER TABLE "clients" ADD COLUMN "conservation_motif" text;

CREATE INDEX "clients_entreprise_efface_idx"
  ON "clients" ("entreprise_id", "efface_le")
  WHERE "efface_le" IS NOT NULL;
