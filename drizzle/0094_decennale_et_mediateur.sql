-- LA DÉCENNALE ET LE MÉDIATEUR DANS « MON ENTREPRISE » — son accord du
-- 14 septembre 2026 (appli/decennale-et-mediateur.html), codé le 16 sur son
-- « oui ».
--
-- ════════════════════════════════════════════════════════════════════════════
-- CE QUE ÇA REMPLACE. Les deux mentions vivaient comme des CROCHETS à remplir
-- à la main dans le texte des conditions générales — « [assureur, n° de
-- contrat, couverture géographique] » et « [nom et coordonnées] ». Il a demandé
-- qu'on les colore en rouge pour les retrouver ; la case est un champ de
-- saisie, elle n'affiche que du texte nu. Et les colorer aurait maquillé le
-- vrai défaut : une information d'entreprise, qui ne bouge qu'une fois par an,
-- se retapait dans un texte — donc se recopiait, donc divergeait au premier
-- changement d'assureur.
--
-- Cinq colonnes, saisies une fois comme le SIRET. Les articles 9 et 11 se
-- remplissent tout seuls à l'impression, et le bas du devis comme celui de la
-- facture les portent.
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "assureur_decennale" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "contrat_decennale" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "couverture_decennale" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "mediateur_nom" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "mediateur_coordonnees" text;

-- ════════════════════════════════════════════════════════════════════════════
-- FIGÉES SUR LE DOCUMENT, comme le SIRET et les mentions légales (0072).
--
-- Un devis dit ce qui était vrai LE JOUR OÙ il est parti : le numéro de contrat
-- d'assurance change, le médiateur aussi. Les lire en direct réécrirait le
-- passé sur une pièce que le client garde — et, pour l'assurance, sur celle qui
-- prouve la couverture au moment du chantier.
--
-- NULL pour tout ce qui existait avant : rien de plus ne s'imprime sur les
-- documents déjà établis, et aucun écran ne tombe (expand seul, aucune
-- contrainte ajoutée — .claude/rules/deployment-safety.md).
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_assureur_decennale" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_contrat_decennale" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_couverture_decennale" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_mediateur_nom" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_mediateur_coordonnees" text;

ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_assureur_decennale" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_contrat_decennale" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_couverture_decennale" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_mediateur_nom" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_mediateur_coordonnees" text;
