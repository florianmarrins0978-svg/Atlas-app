-- Retirer « Chez » des noms de chantier déjà enregistrés.
--
-- **Le patron, le 2026-08-13, capture à l'appui :** *« corrige le nom, Mr
-- Martins, pas chez Martins ! »*
--
-- `nomDuChantier` fabriquait « Chez <client> » à la création ; il rend
-- désormais le nom du client tel qu'il l'a écrit (`src/lib/nom-chantier.ts`).
-- Sans cette migration, la correction ne vaudrait que pour les chantiers À
-- VENIR : celui qu'il a sous les yeux garderait son « Chez », et il dirait —
-- à raison — que rien n'a été corrigé.
--
-- =========================================================================
-- Pourquoi la condition est aussi étroite
-- =========================================================================
--
-- On ne retire le préfixe que lorsque le reste du nom est EXACTEMENT le nom du
-- client rattaché. Autrement dit : uniquement les étiquettes que nous avons
-- fabriquées nous-mêmes.
--
-- Un `LIKE 'Chez %'` seul aurait suffi à faire le travail — et aurait aussi
-- réécrit « Chez les Dupont, portail du fond » si le patron l'avait un jour
-- saisi. Il ne le peut pas aujourd'hui (le nom n'est jamais modifiable après
-- la création), mais une migration se relit dans six mois, quand un écran de
-- renommage existera peut-être. Réécrire ce qu'un patron a tapé n'est pas une
-- correction, c'est une perte.
--
-- La comparaison ignore les espaces de bord, comme le fait le code : le nom du
-- client est saisi à la main, et « Martins » suivi d'une espace est le même
-- homme.
--
-- Aucune donnée n'est perdue : le préfixe est un mot ajouté par nous, jamais
-- une information sur le chantier.

UPDATE chantiers ch
   SET nom = btrim(cl.nom)
  FROM clients cl
 WHERE cl.id = ch.client_id
   AND ch.nom = 'Chez ' || btrim(cl.nom);
