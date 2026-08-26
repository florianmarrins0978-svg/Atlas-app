-- QUELLE LIGNE DE DEVIS PORTE QUELLES PRESTATIONS
--
-- **Ce lien n'existait pas.** Une ligne de devis et les prestations qu'elle
-- vend ne se connaissaient que par leur TEXTE : la ligne portait les libellés
-- des prestations, collés par des retours à la ligne. C'est de là que vient la
-- corruption du 26 août 2026 — un montant posé sur une ligne portant deux
-- travaux était attribué au premier mot de métier reconnu.
--
-- ─── La cardinalité, inspectée et non choisie par facilité ──────────────────
--
-- Le patron a demandé de ne pas figer `prestation_id` sur `lignes_prix` sans
-- vérifier. Vérification faite, dans `src/lib/lignes-vendables.ts` :
--
--   * **une ligne commerciale porte 1 à N prestations.** C'est SA règle du
--     7 août : « l'abattage, le broyage et l'évacuation, c'est sur une ligne ».
--     Une simple colonne `lignes_prix.prestation_id` serait donc fausse — elle
--     n'en retiendrait qu'une, et perdrait les deux autres ;
--   * **une prestation appartient à 0 ou 1 ligne.** Le découpage range chaque
--     libellé dans un seul groupe (`continue` après chaque motif), et le
--     billonnage absorbé n'entre dans aucun. Aucune prestation n'est donc
--     partagée entre deux lignes ;
--   * **la plupart des lignes ne portent AUCUNE prestation** : une ligne
--     ajoutée à la main, une ligne dictée dans le devis, une ligne née d'un
--     tarif. Le lien est facultatif des deux côtés.
--
-- D'où une table de liaison plutôt qu'une colonne, avec une **unicité sur la
-- prestation** qui interdit qu'elle se retrouve dans deux lignes.
--
-- **Cette unicité vient du CODE, pas d'une décision du patron**, et il faut le
-- savoir : rien dans le dépôt ne dit qu'un même travail ne pourrait pas être
-- vendu sur deux lignes. On encode donc ce que l'application fait réellement
-- aujourd'hui, et pas davantage. Si le métier demande un jour le contraire,
-- **retirer une contrainte d'unicité est une migration d'une ligne** ; laisser
-- entrer des données qui la violeraient et vouloir la poser ensuite ne l'est
-- pas. Le conservatisme va dans ce sens-là.
--
-- ─── Ce que la suppression doit faire ───────────────────────────────────────
--
-- Le patron a demandé de ne pas choisir un CASCADE par facilité.
--
--   * **ligne de prix supprimée → le lien disparaît.** Il ne décrit plus rien :
--     la ligne n'existe plus. La prestation, elle, reste — le travail est
--     toujours à faire, il n'est simplement plus vendu sur cette ligne-là.
--   * **prestation supprimée → le lien disparaît aussi.** Le garder laisserait
--     un identifiant qui ne désigne rien (le risque R16). La ligne de devis,
--     elle, survit avec son montant : le patron a pu la vouloir.
--
-- Dans les deux cas le CASCADE porte sur **la liaison**, jamais sur ce qu'elle
-- relie. C'est ce qui la rend sûre.

CREATE TABLE IF NOT EXISTS "lignes_prix_prestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entreprise_id" uuid NOT NULL REFERENCES "entreprises"("id") ON DELETE CASCADE,
  "ligne_prix_id" uuid NOT NULL,
  "prestation_id" uuid NOT NULL,

  -- L'ordre des prestations DANS la ligne — celui de la dictée, celui qu'il
  -- relit. Sans lui, « abattage, broyage, évacuation » ressortirait dans
  -- l'ordre où la base a envie de le rendre.
  "ordre" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),

  -- **Les clés étrangères portent l'entreprise**, comme partout dans ce dépôt
  -- (migration 0023) : un identifiant venu d'une autre société ne référence
  -- rien, et la RLS n'a pas à rattraper une erreur de conception.
  CONSTRAINT "lignes_prix_prestations_ligne_fk"
    FOREIGN KEY ("ligne_prix_id", "entreprise_id")
    REFERENCES "lignes_prix"("id", "entreprise_id") ON DELETE CASCADE,
  CONSTRAINT "lignes_prix_prestations_prestation_fk"
    FOREIGN KEY ("prestation_id", "entreprise_id")
    REFERENCES "prestations"("id", "entreprise_id") ON DELETE CASCADE,

  -- Une prestation ne se vend pas deux fois. Voir l'en-tête : c'est ce que
  -- l'application fait déjà, et cela se relâche en une ligne si le métier le
  -- demande.
  CONSTRAINT "lignes_prix_prestations_une_seule_ligne" UNIQUE ("prestation_id", "entreprise_id")
);

-- « Quelles prestations porte cette ligne ? » — la question de tous les
-- lecteurs, à chaque affichage de devis.
CREATE INDEX IF NOT EXISTS "lignes_prix_prestations_ligne_idx"
  ON "lignes_prix_prestations" ("entreprise_id", "ligne_prix_id", "ordre");

ALTER TABLE "lignes_prix_prestations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lignes_prix_prestations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "lignes_prix_prestations_isolation" ON "lignes_prix_prestations"
  USING ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid)
  WITH CHECK ("entreprise_id" = NULLIF(current_setting('app.entreprise_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "lignes_prix_prestations" TO atlas_app;

COMMENT ON TABLE "lignes_prix_prestations" IS
  'Quelles prestations une ligne de devis vend réellement. Une ligne en porte 1 à N (sa règle du 7 août) ; une prestation appartient à 0 ou 1 ligne. Les anciennes lignes n''en portent aucune : rien n''a été deviné.';
