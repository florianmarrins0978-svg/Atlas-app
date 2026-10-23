-- LES FACTURES DE SES FOURNISSEURS — sa demande du 23 octobre 2026 : *« que
-- les factures s'enregistrent ici, en photo, en PDF ou en CSV »*, et son choix
-- du même soir, un onglet à part (`appli/fournisseur-factures.html`, B).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- **LA MÊME TABLE QUE LES DEVIS REÇUS, ET NON UNE SECONDE.** Une facture reçue
-- se range, se lit et s'ouvre exactement comme un devis reçu : même fichier
-- gardé, même lecture des prix, même porte de téléchargement, même export. Une
-- seconde table aurait recopié tout cela, et les deux auraient divergé. Ce qui
-- les sépare tient dans `genre`.
--
-- **EXPAND SEUL** (`.claude/rules/deployment-safety.md`) : trois colonnes
-- ajoutées, toutes avec une valeur pour les lignes déjà là ; une contrainte
-- élargie. Le code d'avant continue d'écrire `devis` sans le savoir.
--
-- **AUCUNE LIGNE N'EST RÉÉCRITE** : ni `UPDATE`, ni conversion. La seule
-- vérification portée sur l'existant est la nouvelle contrainte de `nature`,
-- qui ACCEPTE tout ce que l'ancienne acceptait (`photo`, `pdf`) : aucune ligne
-- habitée ne peut la violer, et PostgreSQL la vérifie sans regarder la RLS.

ALTER TABLE "devis_recus"
  ADD COLUMN IF NOT EXISTS "genre" text NOT NULL DEFAULT 'devis'
    CONSTRAINT "devis_recus_genre_check" CHECK ("genre" IN ('devis', 'facture'));

-- Les totaux imprimés sur une facture, tels qu'Atlas les a lus. Vides quand ils
-- ne se lisent pas, ou pour un devis : rien ne se calcule à leur place.
ALTER TABLE "devis_recus"
  ADD COLUMN IF NOT EXISTS "total_ht" numeric(12, 2)
    CONSTRAINT "devis_recus_total_ht_check" CHECK ("total_ht" IS NULL OR "total_ht" >= 0);
ALTER TABLE "devis_recus"
  ADD COLUMN IF NOT EXISTS "total_ttc" numeric(12, 2)
    CONSTRAINT "devis_recus_total_ttc_check" CHECK ("total_ttc" IS NULL OR "total_ttc" >= 0);

-- Un fichier Excel ou CSV se garde comme une photo ou un PDF.
ALTER TABLE "devis_recus" DROP CONSTRAINT IF EXISTS "devis_recus_nature_check";
ALTER TABLE "devis_recus"
  ADD CONSTRAINT "devis_recus_nature_check" CHECK ("nature" IN ('photo', 'pdf', 'tableur'));

-- Le prix que remplace une facture, quand elle en change un : l'écran le montre
-- barré à côté du nouveau. Vide pour un prix tapé, lu sur un devis, ou inchangé.
ALTER TABLE "prix_achat"
  ADD COLUMN IF NOT EXISTS "prix_avant" numeric(12, 2)
    CONSTRAINT "prix_achat_prix_avant_check" CHECK ("prix_avant" IS NULL OR "prix_avant" >= 0);

COMMENT ON TABLE "devis_recus" IS 'Les devis et les factures reçus de ses fournisseurs et partenaires, leur fichier gardé (19 et 23 octobre 2026).';
