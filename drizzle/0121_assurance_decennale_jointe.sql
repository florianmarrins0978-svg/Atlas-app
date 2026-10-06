-- L'ASSURANCE DÉCENNALE EN RÈGLE — son choix A du 5 octobre 2026
-- (`appli/assurance-et-sous-traitance.html`, `docs/check-up-legal-documents.md`
-- points 1 et 2).
--
-- 1. Les coordonnées de l'assureur : la loi 96-603 (art. 22-2) les veut sur
--    chaque devis et chaque facture ; Atlas n'en gardait que le nom.
-- 2. L'attestation elle-même, jointe en dernières pages (C. ass. L243-2) : la
--    clé du fichier déposé, et son format (PDF, JPEG ou PNG).
--
-- Recopiées sur le devis et la facture comme le reste de l'identité : c'est
-- l'attestation du jour de la pièce qui prouve la couverture du chantier.
--
-- Expand seul : des colonnes nullables, aucune ligne réécrite, aucune
-- contrainte. L'ancien code les ignore ; une pièce d'avant n'a rien à joindre
-- (`.claude/rules/deployment-safety.md`).
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "adresse_assureur_decennale" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "attestation_decennale_cle" text;
ALTER TABLE "entreprises" ADD COLUMN IF NOT EXISTS "attestation_decennale_mime" text;

ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_adresse_assureur_decennale" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_attestation_decennale_cle" text;
ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "entreprise_attestation_decennale_mime" text;

ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_adresse_assureur_decennale" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_attestation_decennale_cle" text;
ALTER TABLE "factures" ADD COLUMN IF NOT EXISTS "entreprise_attestation_decennale_mime" text;
