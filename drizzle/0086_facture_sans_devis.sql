-- FACTURER SANS PASSER PAR LA CASE DEVIS — sa demande du 10 septembre 2026 :
-- « il faut que l'on puisse facturer sans avoir besoin de passer par la case
-- devis ». Un dépannage fait dans la journée et réglé sur place n'a pas de
-- devis, et n'en aura jamais.
--
-- ─── LA RACINE ÉTAIT ICI, ET NULLE PART AILLEURS ──────────────────────────
--
-- Tout le reste existait déjà : la reconnaissance du client au nom, l'éditeur
-- de lignes avec sa TVA, l'ouverture du SMS avec le message tout prêt. Seule
-- cette colonne interdisait la chose — `devis_id NOT NULL` veut dire qu'aucune
-- facture ne peut exister sans devis.
--
-- **LE FAUX DEVIS CACHÉ EST ÉCARTÉ**, et c'est le fond de cette migration. Il
-- suffisait de fabriquer un devis invisible derrière chaque facture directe
-- pour que la colonne soit satisfaite sans y toucher — un pansement, au sens
-- exact de `CLAUDE.md` §4 quater : il n'enlève rien, il recouvre. Et il aurait
-- coûté cher : le devis fantôme aurait consommé un numéro de la suite
-- commerciale, serait apparu dans les listes, et le relevé de TVA aurait porté
-- des références de devis qui n'existent pour personne — à commencer par
-- l'administration, le jour d'un contrôle.
--
-- ─── CE QUI PROTÈGE ENCORE, ET QUI N'A PAS BOUGÉ ──────────────────────────
--
-- La clé étrangère composite `factures_devis_entreprise_fk` reste en place et
-- reste utile : PostgreSQL applique MATCH SIMPLE, donc elle ne contrôle rien
-- quand `devis_id` est NUL, et contrôle tout — l'existence du devis ET son
-- appartenance à la même entreprise — dès qu'il porte une valeur. Une facture
-- née d'un devis ne peut toujours pas désigner le devis du voisin.
--
-- Le trigger d'immuabilité, la RLS et l'unicité par chantier ne sont pas
-- touchés : une facture directe est une facture comme les autres.

ALTER TABLE "factures" ALTER COLUMN "devis_id" DROP NOT NULL;

COMMENT ON COLUMN "factures"."devis_id" IS
  'Le devis dont la facture reprend les lignes. NUL = facture directe, faite '
  'sans devis (dépannage réglé sur place) — il n''y a alors rien à reprendre, '
  'et toutes ses lignes se saisissent à la main (src/lib/lignes-corrigeables.ts).';
