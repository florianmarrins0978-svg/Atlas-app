-- LA FICHE DE SÉCURITÉ — la fiche d'intervention du décret 2021-1833, en base.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **Sa question du 21 septembre 2026 :** *« en élagage il y a besoin de faire
-- des fiches avant l'intervention, apparemment c'est devenu obligatoire »*.
-- C'est vrai — décret n° 2021-1833, art. R. 717-85-16 du code rural, lu à la
-- source : une fiche établie AVANT tout chantier d'abattage ou d'élagage, signée
-- par le chef d'entreprise, montrée aux travailleurs, disponible sur le chantier
-- (« possiblement dématérialisée » — c'est ce qui autorise le téléphone), et
-- conservée deux ans à compter de sa signature.
--
-- Ses décisions, prises sur la planche `appli/fiche-de-securite.html` le même
-- jour : elle s'appelle « Fiche de sécurité » (pas « d'élagage » : *« les
-- utilisateurs ne font pas que ça »*) ; elle se propose sur TOUS les chantiers,
-- au bon vouloir de l'utilisateur, depuis la fiche du jour ; signature au doigt ;
-- un bouton pour la transmettre ; rangée dans Paysage.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **POURQUOI UNE COLONNE jsonb, ET PAS UNE COLONNE PAR CASE.**
--
-- La fiche est un formulaire de quatre pages (MSA 12350_A_10/2023) dont chaque
-- case est un mot de la MSA que l'artisan complète des siens — le décret
-- n'impose aucune liste. Rien ne se compte ni ne se trie sur une case : la
-- seule lecture SQL est « la fiche de ce chantier » et « les fiches de ce
-- mois ». Une colonne par case aurait figé les mots de la MSA dans le schéma,
-- et le premier mot qu'il ajoute aurait demandé une migration. Le contenu est
-- typé et validé dans `src/lib/fiche-securite.ts`, qui est la seule vérité.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **DEUX ANS, ET RIEN QUI EFFACE.**
--
-- Aucune purge ne touche cette table. Une fiche disparaît avec son chantier
-- (`ON DELETE CASCADE`) : aujourd'hui rien ne supprime un chantier hors de la
-- suppression de l'entreprise elle-même (`docs/RGPD.md` §4). Sa question du
-- 21 septembre — *« où cette fiche sera enregistrée ? on doit la garder 2 ans »*
-- — a une seule réponse : ici, avec le chantier, et le PDF se refait à la
-- demande depuis ce contenu.
--
-- **Le piège est dans les PHOTOS**, comme pour les retours (migration 0080) :
-- la photo du chantier que la fiche montre ne doit jamais partir en purge quand
-- on l'efface de la pellicule. La table de liaison existe pour que
-- `supprimerPhoto` puisse poser la question.
--
-- Cette migration ne touche aucune ligne existante : trois tables neuves, vides.
-- Rien à compter, rien à prouver sous RLS.

CREATE TABLE "fiches_securite" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "chantier_id" uuid NOT NULL REFERENCES "chantiers"("id") ON DELETE CASCADE,
  -- Le contenu entier : `ContenuFiche` de `src/lib/fiche-securite.ts`.
  "contenu" jsonb NOT NULL,
  -- La dernière étape passée avec « Suivant » : le bandeau du planning écrit
  -- « 3 sur 6 » tant qu'elle n'est pas signée.
  "etape_vue" integer NOT NULL DEFAULT 0,
  -- L'écran « ce que demande la loi » se lit une fois, à la première ouverture.
  "loi_lue" boolean NOT NULL DEFAULT false,
  -- La signature au doigt, en PNG (data URL). NULL tant qu'elle n'est pas
  -- signée ; « Modifier » une fiche signée la remet à NULL — on re-signe.
  "signature_png" text,
  "signataire" text,
  "signee_par" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "signee_le" timestamptz,
  "transmise_le" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
-- UNE fiche par chantier : elle se reprend et se modifie, elle ne se dédouble
-- pas. Deux fiches signées pour un même chantier, personne ne saurait laquelle
-- fait foi devant un contrôleur.
CREATE UNIQUE INDEX "fiches_securite_chantier_uk" ON "fiches_securite" ("chantier_id");
-- La liste de Paysage se lit par entreprise, un mois à la fois.
CREATE INDEX "fiches_securite_signees_idx" ON "fiches_securite" ("entreprise_id", "signee_le" DESC);

CREATE TABLE "fiches_securite_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "fiche_id" uuid NOT NULL REFERENCES "fiches_securite"("id") ON DELETE CASCADE,
  "photo_id" uuid NOT NULL REFERENCES "photos"("id") ON DELETE CASCADE,
  "ordre" integer NOT NULL DEFAULT 0,
  CONSTRAINT "fiches_securite_photos_uk" UNIQUE ("fiche_id", "photo_id")
);
CREATE INDEX "fiches_securite_photos_par_photo_idx" ON "fiches_securite_photos" ("photo_id");

-- Ce qui est gardé d'une fiche à l'autre, par entreprise — `MemoireDesFiches` :
-- la main d'œuvre, le lieu de la trousse, les deux textes de la co-activité,
-- les observations, et ses ajouts aux listes. Rien d'autre tant qu'il ne l'a pas
-- dit (*« pour les autres je te le dirai plus tard »*).
CREATE TABLE "fiches_securite_memoire" (
  "entreprise_id" uuid PRIMARY KEY REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "contenu" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "fiches_securite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiches_securite" FORCE ROW LEVEL SECURITY;
CREATE POLICY "fiches_securite_isolation" ON "fiches_securite"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "fiches_securite" TO atlas_app;

ALTER TABLE "fiches_securite_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiches_securite_photos" FORCE ROW LEVEL SECURITY;
CREATE POLICY "fiches_securite_photos_isolation" ON "fiches_securite_photos"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "fiches_securite_photos" TO atlas_app;

ALTER TABLE "fiches_securite_memoire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fiches_securite_memoire" FORCE ROW LEVEL SECURITY;
CREATE POLICY "fiches_securite_memoire_isolation" ON "fiches_securite_memoire"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "fiches_securite_memoire" TO atlas_app;
