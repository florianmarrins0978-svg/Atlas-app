-- **Quatre manques que le devis du 26 août 2026 a rendus visibles.**
--
-- Migration ADDITIVE de bout en bout : que des colonnes nouvelles, toutes
-- nullables ou avec un défaut qui reproduit exactement le comportement
-- d'aujourd'hui. Aucune donnée existante n'est relue, réinterprétée ni
-- réécrite — une prestation d'avant reste ce qu'elle était, et rien ne prétend
-- connaître des champs qu'elle n'a jamais portés.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 1. « À CHIFFRER » N'EST PAS « 0 € »
-- ─────────────────────────────────────────────────────────────────────────
--
-- Quand aucun prix n'est calculable, la ligne s'écrivait à `0`. Sur un devis,
-- un zéro se lit « gratuit » : c'est un montant, donc une décision, là où il
-- n'y avait qu'une ignorance. Le patron pouvait envoyer ce document.
--
-- **Pourquoi un DRAPEAU et non un prix nullable.** Rendre `montant` nullable
-- remonterait jusqu'à `lignes_facture`, donc jusqu'à la facturation et la
-- numérotation — hors périmètre, et un devis facturé à NULL serait bien pire
-- que le zéro qu'on répare. Le drapeau vit là où la décision se prend : sur le
-- brouillon de prix, puis sur le document qu'il relit avant d'envoyer.
--
-- **Il descend jusqu'à `lignes_devis`, et c'est délibéré.** Le devis est une
-- photographie ; s'il ne portait pas l'état, le contrôle avant envoi devrait
-- relire les lignes de prix — qui ont pu bouger depuis. Le document sait donc
-- lui-même qu'il n'est pas complet.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 2. L'UNITÉ N'ARRIVAIT PAS JUSQU'AU DOCUMENT
-- ─────────────────────────────────────────────────────────────────────────
--
-- `lignes_prix` porte `unite` depuis longtemps ; `lignes_devis` ne la copiait
-- pas. « 800 × 17,50 € » se lisait donc sans savoir 800 de quoi.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 3. UNE CORRECTION HUMAINE DOIT SE VOIR
-- ─────────────────────────────────────────────────────────────────────────
--
-- Le dépôt n'avait aucune colonne de provenance : impossible de distinguer une
-- quantité lue par un modèle d'une quantité corrigée par l'artisan. La règle
-- « on ne remplace jamais ce qui est posé » tenait lieu de garde-fou, mais elle
-- ne dit pas QUI a posé — et devant une contradiction entre la colonne et le
-- libellé, le produit refusait de chiffrer même quand c'est le patron
-- lui-même qui avait tranché.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 4. LA COMPARABILITÉ V2, À CÔTÉ DE LA V1 — JAMAIS À SA PLACE
-- ─────────────────────────────────────────────────────────────────────────
--
-- `lecons_prix.signature` porte des clés DÉJÀ STOCKÉES (`abattage|retention|d70`).
-- Les réécrire orphelinerait toute la mémoire de prix du patron, sans un mot et
-- sans erreur. La V2 prend donc une colonne à elle, et la V1 reste lue telle
-- quelle.
--
-- Les trois colonnes qui l'accompagnent — espèce, quantité, unité — existent
-- pour une raison précise : **pouvoir calibrer plus tard, sur ses vrais devis,
-- le seuil d'écart de quantité au-delà duquel deux chantiers cessent d'être
-- comparables.** Rien dans le dépôt ne justifie aujourd'hui un facteur ×2 ou
-- ×5 ; les inventer serait exactement le genre de chiffre qui revient ensuite
-- avec l'autorité de l'expérience. On enregistre donc la matière du calcul, et
-- on s'en tient d'ici là à des critères éliminatoires certains.

-- --- 1. « À chiffrer » ---------------------------------------------------

ALTER TABLE "lignes_prix"
  ADD COLUMN IF NOT EXISTS "a_chiffrer" boolean NOT NULL DEFAULT false;

ALTER TABLE "lignes_devis"
  ADD COLUMN IF NOT EXISTS "a_chiffrer" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "lignes_prix"."a_chiffrer" IS
  'Le travail est identifié, son prix ne l''est pas. Ni gratuit, ni oublié : le devis ne peut pas partir tant qu''elle est vraie.';

-- --- 2. L'unité jusqu'au document ---------------------------------------

ALTER TABLE "lignes_devis"
  ADD COLUMN IF NOT EXISTS "unite" text;

-- --- 3. La correction humaine -------------------------------------------

ALTER TABLE "prestations"
  ADD COLUMN IF NOT EXISTS "corrige_par_humain" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "prestations"."corrige_par_humain" IS
  'L''artisan a posé lui-même ces valeurs. Aucune extraction ne les écrase, et elles tranchent quand le libellé dit autre chose.';

-- --- 4. La comparabilité V2 ----------------------------------------------

ALTER TABLE "lecons_prix"
  ADD COLUMN IF NOT EXISTS "signature_v2" text,
  ADD COLUMN IF NOT EXISTS "espece" text,
  ADD COLUMN IF NOT EXISTS "quantite" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "unite" text;

COMMENT ON COLUMN "lecons_prix"."signature_v2" IS
  'Clé de rapprochement V2, construite depuis les colonnes structurées. NULL sur les leçons d''avant : leur libellé fait alors foi, relu par le mécanisme historique.';

-- **Le même invariant que sur `prestations`** : une quantité sans son unité ne
-- veut rien dire, et 800 ml ne se compare pas à 800 m².
ALTER TABLE "lecons_prix"
  DROP CONSTRAINT IF EXISTS "lecons_prix_quantite_avec_unite";
ALTER TABLE "lecons_prix"
  ADD CONSTRAINT "lecons_prix_quantite_avec_unite"
  CHECK (("quantite" IS NULL) = ("unite" IS NULL));

ALTER TABLE "lecons_prix"
  DROP CONSTRAINT IF EXISTS "lecons_prix_quantite_positive";
ALTER TABLE "lecons_prix"
  ADD CONSTRAINT "lecons_prix_quantite_positive"
  CHECK ("quantite" IS NULL OR "quantite" > 0);

-- La recherche se fait d'abord sur la V2 quand elle existe ; sans cet index
-- elle balaierait toute la mémoire de l'entreprise à chaque ligne de devis.
CREATE INDEX IF NOT EXISTS "lecons_prix_signature_v2_idx"
  ON "lecons_prix" ("entreprise_id", "signature_v2", "constate_le");
