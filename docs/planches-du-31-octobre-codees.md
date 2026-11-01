# Les planches du 31 octobre, codées

**Ta consigne du 1er novembre 2026 :** *« une fois que t'as fait ça tu peux tout coder, une fois vert tu fusionnes »*.

Neuf écrans, chacun sur la vue « Proposé » de sa planche. Rien d'autre n'a été touché.

## Ce qui est fait, écran par écran

| Écran | Ce qui change | Où |
|---|---|---|
| **Le devis du client** | Le numéro en grand titre, tes initiales en or, « Atelier Démo EI, pour Mme X ». Le TTC en grand, HT et TVA sur une ligne. Les deux dates côte à côte en grandes cases (le jour en mot, la date en serif). Le mot pour toi s'ouvre au doigt. « Une correction » et « Je ne donne pas suite » côte à côte. **Tient toujours dans l'écran sans défiler**, case de rétractation comprise. | `src/app/devis/[jeton]/page.tsx`, `formulaire.tsx` |
| **La facture du client** | La carte centrée d'aujourd'hui, soignée : Facture en or, le numéro en grand, l'échéance en pastille, Télécharger en plein, les pilules à copier (64 points, « Copier » au pouce), l'accusé de réception en pilule qui passe au vert. Toujours aucun montant. | `src/app/factures/[jeton]/` |
| **Le contrat du client** | Le total, « 3 prestations, 18 passages », le détail dans le PDF. Accepté ou refusé : un écran de retour, comme le devis. | `src/app/contrat/[jeton]/` |
| **Les dates du mois** | Le jour en grand à gauche, « Votre date » en or quand il en change une, le calendrier dans une feuille qui monte. | `src/app/contrat/dates/[jeton]/` |
| **Le compte rendu** | « Retour d'intervention » en grand titre, une coche verte par ligne, le temps passé et ton mot en serif. | `src/components/atlas/RapportEntretien.tsx` |
| **Non payées** | « Reste à recevoir » en tête sur la bande dorée, une plage par facture avec son chevron. | `src/app/termines/non-payees/page.tsx` |
| **Retours d'intervention** | Rangés par client avec leur nombre, le jour en grand, « 2 tâches sur 3 », « À signaler » dès la liste, « Pas fait » en ambre. La barre de recherche et le mois n'ont pas bougé. | `src/app/termines/retours/ListeDesRetours.tsx` |
| **Son contrat d'entretien** | Les mois écrits (« Janv. », six par rangée), le catalogue dans une feuille, ce qui manque en ambre sous les mois, le TTC en grand. **L'envoi n'a pas bougé** (ta consigne). Envoyé : une pastille « En attente de sa réponse ». | `src/app/clients/[id]/contrat/ContratClient.tsx` |
| **Ses coordonnées** | La mise en page de ta Fiche client : pastilles, nom et téléphone côte à côte, les numéros d'une entreprise côte à côte, le n° TVA tiré du SIRET proposé (jamais écrit seul). Pas de vocal, et pas de photos (ta décision, une fois l'écran vu : *« ajouter des photos est inutile »*). On y arrive par Vos clients, le client, « Modifier ses coordonnées ». | `src/app/clients/[id]/coordonnees/` |

## Ce qui a été fait autrement que la planche, et pourquoi

| Point | Ce qui a été fait | Pourquoi |
|---|---|---|
| La date du compte rendu | Le jour reste **en gras et en noir** (« **Jeudi 29 octobre 2026** chez M. Bernard ») | Ta demande du 22 septembre. La planche l'avait mise en gris sans le dire. |
| Le compte rendu dans l'appli (« Rapport envoyé ») | Il suit ta charte, comme tous tes écrans | Il avait des couleurs fixes. La page de ton client, elle, garde les couleurs d'Atlas. |
| Contrat accepté, chez toi | La phrase « Ses passages arrivent dans Sans date… » en vert, sans pastille | Trop longue pour une pastille sur un téléphone : elle sortait de l'écran. |
| La ligne d'un retour | Le nombre de photos n'y est plus | Comme sur la planche : les photos se voient en l'ouvrant. |

## Ce qui a été trouvé et corrigé en passant

- Le contrat, les dates du mois et le compte rendu écrivaient leurs couleurs **en dur**, et une autre police de titre que le devis : les cinq pages du client parlent maintenant d'une même voix.
- Le total de Non payées s'additionne **au centime** (une addition en virgule flottante rendait 4 270,799999 sur trois factures).

## Les contrôles

| | |
|---|---|
| Écrans regardés | les neuf, au format de ton téléphone, chacun dans ses états (dates proches, calendrier ouvert, correction sans mot, contrat accepté, retour ouvert…) |
| Suites neuves | `test-jours-sur-deux-lignes`, `test-somme-des-montants`, et la suite du dernier chantier, retirée avec les photos |
| Suites adaptées | six suites lisaient un mot que tes planches ont changé (« Pour Mme », « 1 sur 2 », la prestation sur la page du contrat, « + Ajouter une prestation », le champ du mot ouvert d'office) : elles visent maintenant la même règle autrement |
| Batterie | types, lint, mémoire, construction et connexion réelle au vert ; suites base 543 sur 545, suites navigateur 202 sur 203 après correction d'une suite (la date lointaine, une majuscule) |
| Les trois rouges | rejoués sur `main` seule, rouges pareil : ils ne viennent pas de ce lot (`verifier-rouge-prealable.ts`). Deux étaient déjà notés hier ; le troisième (`test-pas-la-ce-jour-e2e`) cherche « hier » dans le mois en cours, et hier était le 31 octobre |

## Ce qui reste ouvert

| Point | Qui tranche |
|---|---|
| Passer la recherche des pièces d'arrosage et des fiches de sécurité sur la barre de l'appli | toi |
