# Mon année : ce qui est codé, ce qui reste

*8 novembre 2026. Sa planche : `appli/soignee/mon-annee.html`. Sa demande :
« tu peux coder ça. Ne lance pas de batterie. »*

## Où en est le lot

| | |
|---|---|
| **Branche** | `claude/eager-cori-g7qv8y` |
| **Sur `main`** | **non**. Niveau 3 (une migration, de l'argent) : il faut la batterie, et elle n'a pas été autorisée |
| **Ce qu'il faut pour le livrer** | son « oui » pour la batterie (`npm run verifier:avant-livraison`), puis la poussée sur `main` |

## Ce qui est codé, point par point

| Point de la planche | Verdict | Où |
|---|---|---|
| Mon année dans Réglages, en tête de L'entreprise | codé | `src/lib/rubriques-reglages.ts` |
| Le patron y entre et écrit ; la facturation lit (sa réponse : « ils peuvent le voir ») ; ni commercial ni salarié | codé | `src/lib/acces-roles.ts` (`REGLAGES_DE_LA_FACTURATION`), `exigerProprietaire` dans les actions |
| L'objectif de l'année : chiffre d'affaires HT, bénéfice facultatif | codé | migration `drizzle/0176_mon_annee.sql`, `src/app/reglages/mon-annee/actions.ts` |
| « Afficher sur Terminés », au-dessus de Face à 2025, **éteint de base** | codé | colonne `entreprises.mon_annee_sur_termines`, faux par défaut |
| La ligne sous les deux boutons de Terminés, seulement allumée | codé | `src/components/atlas/LigneMonAnnee.tsx`, `src/app/termines/page.tsx` |
| Le chiffre, sa jauge, le trait de la saison, le retard ou l'avance | codé | `etatDeLAnnee`, `src/lib/mon-annee.ts` |
| Face à 2025 : le jour même, puis du 1er à aujourd'hui | codé | `faceAnDernier` |
| Tous les mois, 2026 d'abord, une bande verte ou bordeaux | codé | `src/app/reglages/mon-annee/MonAnnee.tsx` |
| Il reste à facturer : d'ici le 31 décembre, ce mois, par jour, mois par mois | codé | `resteMoisParMois` |
| Ce qui peut encore rentrer, et ce qu'il manque encore de devis signés | codé | `donneesMonAnnee`, `manqueEncore` |
| Le bénéfice, sur 1 000 € encaissés, et son compte | codé | `beneficeEstime` |
| Les factures importées comptent par leur HT, les anciennes relues une fois (avec l'IA) | codé | `lireChampsDuTexte`, `lireLeHt`, `chercherLesHt`, `htDeLaPieceImportee` |
| **Vos prix, par vos tarifs** | **pas codé : lot 2** | voir plus bas |

## Ce qui a été fait autrement que la planche, et pourquoi

- **Les factures importées comptent par leur HT.** L'import ne lisait que le TTC ; il lit désormais le « Total HT » imprimé, ou le total d'une facture en franchise (« 293 B »). Les factures importées avant se relisent une fois, dix à chaque ouverture de Mon année : le texte d'abord, l'IA ensuite, sur vos crédits (votre réponse : « tu peux les lire avec l'IA aussi »). **Une facture dont le HT reste illisible ne compte pas** : le HT ne se déduit pas du TTC, le taux varie.
- **Sans année dernière dans l'appli, ni trait, ni retard, ni Face à 2025.** Rien ne s'invente. Le reste à facturer se répartit alors sur les jours ouvrés.
- **« Pareil » ne se dit que de deux montants égaux.** La planche disait « Pareil » sous 100 € d'écart : 80 € de plus n'est pas pareil.
- **Une sortie de banque sans pièce compte comme une dépense.** Elle est partie ; l'ignorer gonflerait le bénéfice. Le compte la montre à part : « Pas encore justifié ».
- **« Ce qui peut encore rentrer » reprend la règle de Terminés** pour les chantiers à facturer, pour que les deux écrans disent le même nombre.

## Ce qui reste ouvert, et qui le tranche

| Point | Proposé par défaut | Qui tranche |
|---|---|---|
| Impôts et cotisations, comptés comme dépense dans le bénéfice | **tranché : oui** | lui, le 8 novembre |
| Le rôle Facturation voit-il Mon année ? | **tranché : oui**, en lecture ; l'objectif et l'interrupteur restent au patron | lui, le 8 novembre |
| **Vos prix (lot 2)** | chaque ligne de devis garde le tarif d'où elle vient (une colonne neuve, sans rien toucher aux anciennes lignes) ; seuls les devis faits ensuite seront rangés | à coder, après la livraison de ce lot |

## Les contrôles

| Contrôle | Résultat |
|---|---|
| Types (`tsc`) | vert |
| Style (`eslint`, fichiers du lot) | vert |
| `test-mon-annee.ts` (règles pures) | vert ; **vu rouge** en cassant volontairement la règle « au même jour » |
| `test-import-pieces.ts` (lecture du HT) | vert ; **vu rouge** en déduisant le HT du TTC |
| Accès, rubriques, couches, code mort, pansements, tirets, flèches, chartes | verts |
| `test-mon-annee-db.ts` (isolation entre entreprises, objectif, interrupteur, factures émises) | **écrite, pas jouée** : elle vide la base, et aucune batterie n'était autorisée |
| L'écran lui-même | **pas regardé ici** : il faut le serveur, et donc son accord |
| La batterie entière | **pas jouée** |
