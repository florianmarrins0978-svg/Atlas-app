-- LE RETOUR D'INTERVENTION — ce que le salarié laisse en partant du chantier
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa décision du 8 septembre 2026**, prise sur maquette
-- (`appli/retours-d-intervention.html`) : *« dans la catégorie terminé il faut
-- rajouter une sous-catégorie à côté de à facturer : retour d'intervention. On
-- clique dessus et on arrive sur une page où seront listés tous les retours par
-- client, avec les infos, et en haut un filtre pour que le patron puisse les
-- retrouver facilement. Et il faut pouvoir les garder longtemps. »*
--
-- Et, le même jour : *« une feuille de preuve de fin de chantier que le salarié
-- remplira ou non, ça sera au patron de décider — mais sur cette feuille il
-- marquera ce qu'ils ont fait sur le chantier avec photo à l'appui »*.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI TROIS TABLES, ET PAS UNE COLONNE SUR `chantiers`.**
--
-- Un retour porte une LISTE — ce qui a été fait, ce qui ne l'a pas été. La
-- ranger dans une colonne texte obligerait à la relire pour compter « 2 sur 3
-- faites », et ce comptage-là est ce que le patron lit en premier. Une ligne par
-- tâche se compte en SQL et ne se relit jamais.
--
-- **Et les tâches sont COPIÉES du devis, pas référencées.** Le devis change — une
-- ligne ajoutée, une quantité corrigée — et un retour qui pointerait dessus
-- raconterait alors un chantier qui n'a pas eu lieu. C'est la même raison qui
-- fait copier les lignes d'un passage d'entretien depuis son modèle
-- (`lignes_passage`, migration 0055) : un document parti ne change plus.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **« IL FAUT POUVOIR LES GARDER LONGTEMPS » — ce que ça impose ICI.**
--
-- Rien dans cette migration ne prévoit d'effacement : pas de `deleted_at`, pas
-- de purge, pas de fenêtre glissante. Un retour disparaît **avec son chantier**
-- et pas autrement.
--
-- **Le piège est ailleurs, et il est dans les PHOTOS.** `supprimerPhoto`
-- (`src/server/repositories/photos.ts`) met la clé de rangement en file de
-- purge : effacer une photo depuis la pellicule du chantier détruirait le
-- fichier que le retour montre encore, des mois plus tard, sans que personne
-- fasse le lien. La table de liaison ci-dessous existe pour que le dépôt
-- puisse poser la question — *cette photo appartient-elle à un retour ?* — avant
-- d'écrire quoi que ce soit dans `fichiers_a_purger`.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **CE QUE CETTE TABLE NE PORTE PAS, ET C'EST VOULU : AUCUN MONTANT.**
--
-- C'est la seule règle du modèle des rôles qui n'a jamais bougé — un salarié ne
-- voit pas un euro, ni dans la page, ni dans un PDF, ni dans une réponse d'API
-- (`docs/QUESTIONS.md` §10). Un retour se lit AVANT de facturer ; il ne facture
-- rien, et son « c'est fini » n'est pas `terminerChantier`, qui crée la facture
-- (`ARCHITECTURE.md` §285, décision C).

CREATE TABLE "retours_intervention" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL REFERENCES "chantiers"("id") ON DELETE CASCADE,
  -- **Qui l'a posé, et quand.** Sa demande du 8 septembre : le geste « c'est
  -- fini » est horodaté et porte un nom. `ON DELETE SET NULL` : un salarié qui
  -- quitte l'entreprise n'efface pas la preuve du travail fait.
  "pose_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "pose_le" timestamptz NOT NULL DEFAULT now(),
  -- Ce qu'il écrit s'il en a besoin — « massif du fond laissé, trop humide ».
  -- NULL quand il n'a rien écrit : c'est le cas ordinaire, et une chaîne vide
  -- ferait afficher une case « À signaler » qui laisserait croire à un mot perdu.
  "a_signaler" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- **UN SEUL RETOUR PAR CHANTIER.** Deux « c'est fini » sur le même chantier —
-- deux salariés, ou un double appui sur un réseau lent — donneraient deux
-- retours à lire pour un seul travail, et le patron ne saurait pas lequel fait
-- foi. Le second appui met donc à jour le premier.
CREATE UNIQUE INDEX "retours_intervention_chantier_uk"
  ON "retours_intervention" ("chantier_id");

-- La page des retours se lit par entreprise, du plus récent au plus ancien.
CREATE INDEX "retours_intervention_recents_idx"
  ON "retours_intervention" ("entreprise_id", "pose_le" DESC);

CREATE TABLE "retours_intervention_taches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "retour_id" uuid NOT NULL REFERENCES "retours_intervention"("id") ON DELETE CASCADE,
  -- Le libellé RECOPIÉ du devis au moment du geste (voir en tête).
  "libelle" text NOT NULL,
  -- **Ce qui n'a PAS été fait reste en base, à faux.** Ne garder que les tâches
  -- cochées donnerait un chantier qui paraît complet — et c'est sur cette
  -- impression-là qu'une facture part pour un travail qui n'a pas eu lieu.
  "faite" boolean NOT NULL DEFAULT false,
  "ordre" integer NOT NULL DEFAULT 0
);

CREATE INDEX "retours_intervention_taches_idx"
  ON "retours_intervention_taches" ("retour_id", "ordre");

-- **LA LIAISON QUI PROTÈGE LES PHOTOS DE LA PURGE.**
--
-- Les photos ne sont pas recopiées : ce sont celles du chantier, prises par le
-- salarié. Ce qui change, c'est qu'elles deviennent **intouchables par la
-- purge** — voir le paragraphe en tête, et `supprimerPhoto`.
CREATE TABLE "retours_intervention_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "retour_id" uuid NOT NULL REFERENCES "retours_intervention"("id") ON DELETE CASCADE,
  "photo_id" uuid NOT NULL REFERENCES "photos"("id") ON DELETE CASCADE,
  "ordre" integer NOT NULL DEFAULT 0
);

-- Une photo ne se joint qu'une fois au même retour : un double appui sur le
-- « + » ne doit pas la faire compter deux fois dans « 3 photos ».
CREATE UNIQUE INDEX "retours_intervention_photos_uk"
  ON "retours_intervention_photos" ("retour_id", "photo_id");

-- **L'index qui rend la question de la purge instantanée** : « cette photo
-- appartient-elle à un retour ? », posée avant chaque suppression.
CREATE INDEX "retours_intervention_photos_par_photo_idx"
  ON "retours_intervention_photos" ("photo_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- L'ISOLATION, sur les trois tables. Une requête hors de `withEntreprise` ne
-- rendra rien, silencieusement — et c'est ce qu'on veut : un retour porte le
-- nom d'un client et des photos de sa propriété.

ALTER TABLE "retours_intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retours_intervention" FORCE ROW LEVEL SECURITY;
CREATE POLICY "retours_intervention_isolation" ON "retours_intervention"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "retours_intervention" TO atlas_app;

ALTER TABLE "retours_intervention_taches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retours_intervention_taches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "retours_intervention_taches_isolation" ON "retours_intervention_taches"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "retours_intervention_taches" TO atlas_app;

ALTER TABLE "retours_intervention_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retours_intervention_photos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "retours_intervention_photos_isolation" ON "retours_intervention_photos"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "retours_intervention_photos" TO atlas_app;

-- ─────────────────────────────────────────────────────────────────────────────
-- LE RÉGLAGE DU PATRON — *« ça sera au patron de décider »*, 8 septembre 2026.
--
-- Deux interrupteurs, et ils vivent sur l'entreprise parce qu'ils valent pour
-- toute l'équipe : demander la preuve, et exiger au moins une photo.
--
-- **Ils partent ÉTEINTS**, et ce n'est pas une timidité. Les allumer d'office
-- reviendrait à bloquer, dès la première mise à jour, un salarié dont le
-- téléphone n'a plus de batterie à 18 h — sur un chantier, sans personne à qui
-- demander. Le patron les allume quand il a décidé que c'était son besoin.
ALTER TABLE "entreprises"
  ADD COLUMN IF NOT EXISTS "retour_demande" boolean NOT NULL DEFAULT false;
ALTER TABLE "entreprises"
  ADD COLUMN IF NOT EXISTS "retour_photo_exigee" boolean NOT NULL DEFAULT false;

COMMENT ON TABLE "retours_intervention" IS
  'Ce que le salarié laisse en partant du chantier : ce qui a été fait, ce qui ne l''a pas été, un mot, des photos. Horodaté, à son nom. Ne facture rien et ne porte aucun montant. Se garde sans limite de temps (migration 0080).';

COMMENT ON TABLE "retours_intervention_taches" IS
  'Les tâches d''un retour, RECOPIÉES du devis au moment du geste. Celles qui n''ont pas été faites restent, à `faite = false` : les retirer donnerait un chantier qui paraît complet.';

COMMENT ON TABLE "retours_intervention_photos" IS
  'Les photos du chantier qu''un retour montre. Elles ne sont pas recopiées — mais leur présence ici INTERDIT de mettre leur clé en file de purge (`fichiers_a_purger`), sans quoi le retour perdrait ses images des mois plus tard.';

COMMENT ON COLUMN "entreprises"."retour_demande" IS
  'Le patron exige-t-il un retour d''intervention en fin de chantier ? Éteint par défaut (migration 0080).';

COMMENT ON COLUMN "entreprises"."retour_photo_exigee" IS
  'Le retour exige-t-il au moins une photo ? Éteint par défaut — l''allumer peut bloquer un salarié dont le téléphone est mort (migration 0080).';
