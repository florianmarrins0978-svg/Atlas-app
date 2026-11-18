-- LE CONTRAT D'ENTRETIEN SIGNÉ DEPUIS SON LIEN.
--
-- Sa question du 18 novembre 2026 (*« que ça soit un devis pour une entreprise,
-- une mairie ou même pour un contrat d'entretien, il y aura la signature ? »*),
-- puis sa planche B validée le même jour : « J'accepte le contrat » ouvre la
-- feuille « Votre signature », comme le devis (migration 0182).
--
--   · `contrats_entretien.signature_png` : le trait du client, en PNG `data:`
--     (la règle de `src/lib/signature-au-doigt.ts`). NULL sur tout contrat
--     d'avant, un refus, un brouillon.
--
-- Le PDF du contrat se compose à chaque ouverture (`pdfDuContrat`) : la
-- signature s'y pose sans fichier à ranger.
--
-- **EXPAND SEUL** : une colonne NULL, aucune ligne lue ni réécrite. Les droits
-- de la table couvrent la colonne.

ALTER TABLE "contrats_entretien" ADD COLUMN IF NOT EXISTS "signature_png" text;
