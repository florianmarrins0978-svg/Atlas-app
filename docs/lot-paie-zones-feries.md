# Les fériés, le motif, les jours travaillés et les zones : codés

*6 novembre 2026. Ta consigne : « oui, code tout ça, tu peux pousser mais ne lance pas de batterie ».*

**Où c'est :** sur la branche `lot/paie-zones-feries`, poussée. **Pas sur `main`** : le lot porte trois migrations, donc il demande la batterie, et le garde-fou de `main` refuse sans elle. Rien ne change sur ton espace tant que ce n'est pas fusionné.

## Ce qui est codé, point par point

| | Verdict | Où |
|---|---|---|
| **1. Les jours fériés en bleu** | codé, comme la planche : la case bleue, le nom à côté de la date, « 11 férié » dans la légende ; un férié sans chantier paraît dans la semaine. Toujours proposable | `src/lib/jours-feries.ts`, `MoisCharge.tsx`, `PastilleFerie.tsx` |
| **Chaque année, tout seul** | oui : les dates se calculent (Pâques, Ascension, Pentecôte en découlent). Aucune liste à mettre à jour | `src/lib/jours-feries.ts` |
| **L'Alsace et la Moselle** | deux fériés de plus (Vendredi saint, 26 décembre), lus dans le code postal de l'entreprise (57, 67, 68) | idem |
| **2. Le motif d'une absence** | codé : Congé, Maladie, Sans solde, Déplacement, Formation, Autre, au planning et dans Réglages, Équipe. Déplacement et Formation comptent travaillés. La note reste « pour vous » | `ChoixDeLaNature.tsx`, migration `0165` |
| **3. Jours travaillés, la A** | codé dans Pour mon comptable, rubrique Mes salariés : le mois entre deux flèches, le compte de chaque salarié, la feuille avec moins, plus, le chiffre tapé (19,5 marche), « Le calcul disait 18 », Remettre, et « Pourquoi 3 jours de moins ? » | `src/app/termines/comptable/jours-travailles/`, migration `0166` |
| **Le PDF du comptable** | codé : une page par mois, aligné comme sur la planche, partagé par le téléphone. Rien ne part sans ton appui | `src/server/pdf/jours-travailles-pdf.ts` |
| **4. Les zones de déplacement** | codé dans Réglages, Équipe, ligne Zones de déplacement sous les absences : Pas de zones, Paysage, Bâtiment ; chaque nom (« Zone 3C ») et chaque borne se changent, une zone s'ajoute ou part, Remettre le barème | `src/app/reglages/equipe/zones/`, migration `0167` |
| **Les zones d'office** | oui : réglées une fois, elles paraissent sous chaque salarié (une pastille par zone, la barre de répartition) et dans le PDF. Jamais réglé : une ligne « Vos salariés ont des zones de déplacement ? Régler » | `JoursTravailles.tsx` |
| **Le chantier le plus loin, le dépôt en zone 1** | oui, tes deux règles | `src/lib/zones-deplacement.ts` |
| **« Il manque une zone, ajoutez-la. »** | oui : le total en rouge, et dans la feuille le jour et le lieu (« Vendredi 6 novembre, Les Landes, adresse non située ») ; le plus sur la bonne zone l'efface. « Une zone de trop, retirez-la. » dans l'autre sens | idem |
| **Toucher une zone sous un salarié** | ouvre ses jours dans cette zone : la date, le code postal et la ville, la rue, chez qui, la distance | idem |
| **La pastille de couleur** | ouvre les sept dégradés ; un appui, et toutes les zones changent, chez tous les salariés et dans le PDF | idem |

## Ce qui a été fait autrement, et pourquoi

| | |
|---|---|
| **Une seule feuille par salarié** | les deux planches en dessinaient chacune une (le chiffre, puis les zones). Réunies : le chiffre en haut, les zones dessous. Un seul endroit pour corriger quelqu'un |
| **Les boutons du motif en capsule** | la planche les dessinait en rectangles arrondis ; ta règle du 12 août veut la même forme pour tous les boutons, et le contrôle l'a refusé |
| **L'icône des zones : une épingle** | celle qui existait (« carte ») est une carte bancaire, vu sur la capture |
| **Changer une borne n'efface pas les zones corrigées** | la planche les remettait à zéro. Un mois déjà envoyé au comptable les garde ; une case corrigée garde son trait d'or et se remet d'un appui |
| **Les chantiers pas encore situés le sont à l'ouverture** | sinon presque tous les jours seraient en rouge : jusqu'ici, seul l'appariement du planning situait les adresses. Huit au plus à chaque ouverture |
| **Corriger les jours : toi et la facturation ; régler les zones : toi seul** | le premier vit dans Pour mon comptable, le second dans Équipe |

## Trouvé en chemin, et corrigé

- **L'écran Équipe perdait le motif des absences déjà notées** (mon lot d'avant) : il se voyait au moment de noter, plus après. Corrigé à la racine : le compilateur refuse désormais l'oubli.
- **Deux défauts vus sur les captures** : les intertitres de la feuille sortaient dans la police des titres ; « de 20 à » se coupait sur deux lignes dans le réglage des zones. Les deux corrigés, recapturés à 360 px.

## Ce qui a été éprouvé ici

| | |
|---|---|
| types, style | verts |
| contrôles purs du dépôt (tirets, flèches, couches, code mort, pansements, boutons, accès, pages gardées, couleurs, PDF, numéros de migration, TODO, mémoire) | **22 sur 22 verts** |
| les règles des jours et des zones (`test-jours-travailles`) | **24 essais verts**, deux vus rouges en cassant exprès |
| les trois migrations | appliquées sur une base vide montée ici ; la nouvelle table est sous RLS forcée, `test-toute-table-est-cloisonnee` vert |
| le PDF | rendu et regardé, avec et sans zones |
| les deux écrans | rendus dans un navigateur, le vrai composant, à 360 et 390 px, en Origine et en Nuit, gestes joués (corriger, motif, zone, couleur, jours d'une zone) |

## Ce qui n'a PAS été éprouvé

- **La batterie**, à ta demande.
- **Deux suites en base**, écrites et jamais jouées : elles vident la base, donc elles attendent ta batterie (`test-nature-absence-repo`, `test-jours-travailles-repo`).
- **Les écrans derrière une vraie connexion** : pas vérifiable ici sans serveur. Aucune suite navigateur ne les ouvre encore.

## Ce qui reste, et qui le tranche

| | qui |
|---|---|
| la batterie, puis `main` | **toi**, ton « oui » |
| le lundi de Pentecôte (journée de solidarité) : compté travaillé ? Aujourd'hui férié, donc retiré, et corrigeable à la main | **toi** |
| le bleu des fériés dans Couleurs, ou fixe | **toi** |
| les deux barèmes (MSA, bâtiment) à vérifier sur les textes de l'année : ce poste ne joint pas le site de la MSA | **toi ou ton comptable** ; ils se changent à l'écran |
| un salarié embauché ou parti en cours de mois, ou à temps partiel | se corrige à la main ; sa fiche n'a ni dates ni jours |
| une suite navigateur pour Jours travaillés et les zones | **moi**, avec la batterie |
