-- ═══════════════════════════════════════════════════════════════════════════
-- Le diagnostic végétal : la base range QUEL refus, pas seulement sa phrase
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **Le défaut, trouvé le 11 septembre 2026 en relisant l'écran.** Sous chacun
-- des sept refus, l'écran écrivait la même dernière phrase — « une photo plus
-- proche peut suffire » —, y compris sous « aucune autre photo ne permettrait
-- de les départager ». Il ne pouvait pas faire autrement : la colonne
-- `motif_refus` portait la PHRASE du refus, jamais sa CLÉ. L'écran ne savait
-- donc pas lequel il affichait, et mettait un seul geste pour tous.
--
-- Pire, la même colonne servait à deux choses : pour `inconclusif`, une phrase
-- de la liste fermée du code ; pour `echoue`, le texte du FOURNISSEUR
-- (« ANTHROPIC_API_KEY est refusée (HTTP 401). »). Le commentaire de la colonne
-- — « vient d'une liste fermée du code » — était faux une fois sur deux.
--
-- **La correction, à la racine (CLAUDE.md §4 quater) :**
--
--   · `refus` — la CLÉ, dans la liste fermée de `MOTIFS_REFUS`
--     (`src/lib/diagnostic-vegetal.ts`), tenue par une contrainte. L'écran
--     compose la phrase ET le geste depuis cette clé : un refus ne peut plus
--     recevoir la consigne d'un autre ;
--   · `panne` — ce que le fournisseur a dit quand personne n'a regardé. Une
--     colonne à part, parce que ce n'est PAS une donnée du dépôt : c'est une
--     trace, affichée en petit pour qui dépanne.
--
-- **Les lignes existantes sont CONVERTIES, pas devinées.** Les sept phrases
-- n'ont jamais changé depuis le 20 août 2026 (vérifié dans l'historique du
-- fichier) : chaque phrase rangée retrouve sa clé, exactement. Une ligne
-- `inconclusif` qui n'en porterait aucune — il n'en existe pas, mais une
-- migration ne le suppose pas — garde sa phrase dans `panne`, et l'écran la
-- montre telle quelle, sans y ajouter de geste.

ALTER TABLE "diagnostics"
  ADD COLUMN IF NOT EXISTS "refus" text,
  ADD COLUMN IF NOT EXISTS "panne" text;

-- ── Ce que le fournisseur a dit va dans sa colonne ─────────────────────────
UPDATE "diagnostics"
   SET "panne" = "motif_refus"
 WHERE "statut" = 'echoue' AND "motif_refus" IS NOT NULL AND "panne" IS NULL;

-- ── Chaque phrase de refus retrouve sa clé ─────────────────────────────────
UPDATE "diagnostics"
   SET "refus" = CASE "motif_refus"
     WHEN 'La base phytosanitaire d’Atlas ne contient encore aucune fiche validée. Aucun diagnostic n’est possible pour l’instant.' THEN 'base_vide'
     WHEN 'Aucune fiche ne correspond à ce qui est visible sur cette photo.' THEN 'aucune_piste'
     WHEN 'Je ne peux pas confirmer l’identification à partir de cette photo.' THEN 'trop_faible'
     WHEN 'Deux problèmes différents expliquent aussi bien cette photo, et aucune autre photo ne permettrait de les départager.' THEN 'trop_proches'
     WHEN 'La photo ne montre pas assez de détails pour identifier quoi que ce soit.' THEN 'photo_illisible'
     WHEN 'Ce type de problème ne se confirme pas sur photo. Une observation sur place est nécessaire.' THEN 'diagnostic_photo_impossible'
     WHEN 'L’essence de l’arbre n’a pas pu être identifiée avec certitude, et sans elle un diagnostic n’aurait pas de valeur.' THEN 'hote_incertain'
   END
 WHERE "statut" = 'inconclusif' AND "refus" IS NULL;

-- Une phrase qu'aucune clé ne reconnaît reste lisible : elle est gardée, pas
-- effacée, et l'écran la montre sans geste.
UPDATE "diagnostics"
   SET "panne" = "motif_refus"
 WHERE "statut" = 'inconclusif' AND "refus" IS NULL AND "motif_refus" IS NOT NULL AND "panne" IS NULL;

-- ── L'ancienne colonne disparaît : deux sources pour une même vérité divergent ──
ALTER TABLE "diagnostics" DROP COLUMN IF EXISTS "motif_refus";

-- ── La liste fermée, tenue par la base et non par la seule bonne volonté ───
ALTER TABLE "diagnostics"
  DROP CONSTRAINT IF EXISTS "diagnostics_refus_ck",
  ADD CONSTRAINT "diagnostics_refus_ck" CHECK (
    "refus" IS NULL OR "refus" IN (
      'base_vide', 'aucune_piste', 'trop_faible', 'trop_proches',
      'photo_illisible', 'diagnostic_photo_impossible', 'hote_incertain'
    )
  ),
  -- Un refus sans rien à montrer serait un écran vide : soit une clé, soit au
  -- moins la phrase d'avant cette migration.
  DROP CONSTRAINT IF EXISTS "diagnostics_refus_complet_ck",
  ADD CONSTRAINT "diagnostics_refus_complet_ck" CHECK (
    "statut" <> 'inconclusif' OR "refus" IS NOT NULL OR "panne" IS NOT NULL
  );
