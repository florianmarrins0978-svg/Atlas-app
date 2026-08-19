-- Le PASSAGE d'entretien : ce qui a été coché, un jour, chez quelqu'un.
--
-- **Sa décision du 17 août 2026** : la fiche vit dans l'onglet « Paysage », à
-- côté de l'arrosage — donc elle s'ouvre SANS client. Le client est nommé
-- quand il veut (arrangement C de `docs/maquettes/77-la-fiche-dans-paysage.html`),
-- et c'est lui qui recevra le rapport.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- POURQUOI LES LIGNES SONT RECOPIÉES ICI, ET NON LUES DANS LE MODÈLE
--
-- C'est l'invariant qu'il a posé le 16 août, et celui qui ne se rattrape pas
-- s'il est manqué : **un rapport déjà envoyé ne change plus jamais.** Retirer
-- « Scarification » du modèle en octobre ne doit rien changer au rapport de
-- juillet, qui est parti chez le client et fait preuve de passage.
--
-- Une jointure vers `prestations_entretien` aurait été plus courte à écrire et
-- fausse au premier retrait : le rapport de juillet aurait perdu une ligne, ou
-- en aurait gagné une, sans que personne ne s'en aperçoive. Les lignes sont
-- donc COPIÉES à l'ouverture du passage — libellé et famille compris, parce
-- qu'un renommage doit lui aussi rester sans effet sur le passé.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "passages_entretien" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,

  -- **NULL tant qu'il ne l'a pas nommé**, et ce n'est pas un trou à combler :
  -- c'est l'arrangement C. La fiche se remplit sans client ; elle ne s'ENVOIE
  -- pas sans lui.
  --
  -- `ON DELETE SET NULL` : effacer un client ne doit pas emporter la preuve
  -- qu'on est passé chez lui. Le passage devient simplement anonyme.
  "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,

  -- Le jour du passage. Le sien, pas celui de la saisie : il remplit parfois le
  -- soir, dans son camion.
  "jour" date NOT NULL,

  -- En minutes, choisi à la molette du téléphone (sa décision : « la A »).
  -- NULL tant qu'il ne l'a pas posé.
  "minutes" integer CHECK ("minutes" IS NULL OR ("minutes" >= 0 AND "minutes" <= 1440)),

  "observations" text,

  -- **Le nom du client, RECOPIÉ à l'envoi.** Deux raisons, et la seconde suffit
  -- à elle seule :
  --   · un rapport parti est figé — le client renommé en octobre ne doit pas
  --     réécrire l'en-tête du rapport de juillet ;
  --   · la page publique n'a pas de contexte d'entreprise, donc `clients` lui
  --     est invisible. Ouvrir cette table au jeton pour un seul nom ferait une
  --     porte de plus sur les coordonnées de TOUS ses clients.
  -- NULL tant que le rapport n'est pas parti : avant, le nom vient de la fiche
  -- client, et il doit pouvoir changer.
  "client_nom" text,

  -- **L'heure d'envoi, et l'empreinte de ce qui est parti.** Ensemble, elles
  -- font la preuve de passage qui remplace les signatures (décision du 16 août).
  -- Tant que `envoye_le` est NULL, le passage est un brouillon qui se modifie.
  "envoye_le" timestamptz,
  "empreinte" char(64),

  -- **Le lien que le client reçoit.** Même mécanique que le devis (migration
  -- 0015) et la facture (0024) : 256 bits d'aléa, jamais dérivé d'un
  -- identifiant — sinon un seul lien reçu rendrait les autres devinables.
  -- NULL tant que le rapport n'est pas parti : un brouillon n'a pas d'adresse
  -- publique, et lui en donner une ferait fuir une fiche en cours de saisie.
  "jeton" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Un passage envoyé porte forcément son empreinte : c'est ce qui le rend
  -- opposable. La contrainte évite qu'un chemin de code l'oublie en silence.
  CONSTRAINT "passages_entretien_envoi_ck"
    CHECK (("envoye_le" IS NULL AND "empreinte" IS NULL AND "jeton" IS NULL)
        OR ("envoye_le" IS NOT NULL AND "empreinte" IS NOT NULL AND "jeton" IS NOT NULL)),
  CONSTRAINT "passages_entretien_jeton_uk" UNIQUE ("jeton")
);

CREATE INDEX "passages_entretien_client_idx"
  ON "passages_entretien" ("entreprise_id", "client_id", "jour" DESC);

ALTER TABLE "passages_entretien" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "passages_entretien" FORCE ROW LEVEL SECURITY;

CREATE POLICY "passages_entretien_isolation" ON "passages_entretien"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- **La lecture publique du rapport, strictement limitée à un jeton exact**
-- posé par le code juste avant la requête (`app.jeton_passage`). Aucune
-- énumération n'est possible : sans le jeton, aucune ligne. C'est la mécanique
-- du devis (migration 0015), et elle vaut ici pour la même raison — le client
-- n'a pas de compte, donc pas de contexte d'entreprise.
--
-- **En LECTURE seule.** Le client ne modifie rien : il reçoit un rapport figé,
-- et le devis lui demandait au contraire de répondre. Une politique d'écriture
-- ici n'aurait aucun usage, et un usage sans surveillance finit par servir.
CREATE POLICY "passages_entretien_lecture_par_jeton" ON "passages_entretien"
  FOR SELECT
  USING ("jeton" = NULLIF(current_setting('app.jeton_passage', true), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON "passages_entretien" TO atlas_app;

-- ═══════════════════════════════════════════════════════════════════════════
-- Les lignes du passage — la COPIE, pas la référence. Voir plus haut.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE "lignes_passage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- **`entreprise_id` porté aussi ici**, et ce n'est pas une redondance : c'est
  -- ce qui permet à la RLS de trancher sans jointure. Une politique qui devrait
  -- remonter au passage pour savoir à qui appartient la ligne serait plus lente
  -- et plus facile à contourner.
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "passage_id" uuid NOT NULL REFERENCES "passages_entretien"("id") ON DELETE CASCADE,

  "famille" text NOT NULL,
  "libelle" text NOT NULL,
  "ordre" integer NOT NULL,

  -- Cochée ou non. Jamais NULL : sur un rapport, « on ne sait pas » n'existe
  -- pas — c'est fait ou ça ne l'est pas.
  "faite" boolean NOT NULL DEFAULT false,

  CONSTRAINT "lignes_passage_libelle_uk" UNIQUE ("passage_id", "libelle")
);

CREATE INDEX "lignes_passage_ordre_idx" ON "lignes_passage" ("passage_id", "ordre");

ALTER TABLE "lignes_passage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lignes_passage" FORCE ROW LEVEL SECURITY;

CREATE POLICY "lignes_passage_isolation" ON "lignes_passage"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

-- Les lignes du rapport suivent leur passage : sans elles, la page publique
-- n'aurait rien à montrer. La jointure est ici inévitable — la ligne ne porte
-- pas le jeton, et le lui recopier ferait deux vérités sur une même adresse.
CREATE POLICY "lignes_passage_lecture_par_jeton" ON "lignes_passage"
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM "passages_entretien" p
     WHERE p."id" = "lignes_passage"."passage_id"
       AND p."jeton" = NULLIF(current_setting('app.jeton_passage', true), '')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON "lignes_passage" TO atlas_app;
