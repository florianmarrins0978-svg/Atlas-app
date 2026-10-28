# La fiche d'un client et les deux loupes, 28 octobre 2026

Ses réponses du soir devant `appli/soignee/client.html` et
`appli/soignee/clients-importer.html` : *« le titre du devis visible, le
montant »*, *« faut faire pareil pour les factures »*, *« rajouter la loupe
pour faire une recherche par nom ou montant »*, la phrase *« Chercher un nom, un
titre, un montant »*, *« mets la première tâche »*, puis *« tu peux coder, ne
lance pas de batterie »*.

Branche : `claude/quatre-planches-atlas-6hi21h`. **Rien n'est sur `main`** : le
lot est de niveau 3 (`npm run niveau`), et la batterie qui l'autoriserait n'a
pas été jouée, à sa demande.

## Le verdict, point par point

| Point | Fait | Où | Vérifié par |
|---|---|---|---|
| Titre et montant TTC des devis sur la fiche | **codé** : le titre en gras, le TTC à droite, le numéro et la date dessous | `src/app/clients/[id]/PieceDuDossier.tsx`, `lignesDeLaPiece` (`src/lib/documents-du-client.ts`) | `test-documents-du-client`, `test-fiche-client-db`, capture de la fiche à 390 et 360 px |
| Pareil pour les factures | **codé** : le titre recopié du devis, le TTC de la facture | `src/server/repositories/fiche-client.ts` | les mêmes |
| Une pièce importée | **son montant lu** s'affiche ; elle n'a pas de titre, l'import n'en lit pas | `fiche-client.ts` | `test-pieces-importees-db` |
| Les fiches : la première tâche | **codé** : la première tâche cochée en titre, « 8 oct. 2026, 6 prestations » dessous | `fiche-client.ts` | `test-fiche-client-db`, capture |
| La loupe de la fiche | **codé** : au-dessus des onglets ; les onglets s'effacent, chaque ligne dit « Devis », « Facture », « Fiche du » ; « Rien ne répond à « … ». » | `RegistresDuDossier.tsx`, `src/lib/recherche-piece.ts` | `test-recherche-piece` (40 cas), `test-fiche-client-e2e` (la loupe au navigateur) |
| La loupe de Vos clients | **codé** : sous les clients trouvés, « 2 devis et factures », titre, montant, référence et client ; un appui ouvre la fiche sur l'onglet de la pièce | `src/app/clients/ListeClients.tsx`, `listerFichesClients` | `test-liste-clients` (dont l'isolation entre entreprises), `test-fiche-client-e2e`, capture |
| La phrase de la case | **codé**, mot pour mot, dans les deux loupes | `AIDE_DE_LA_LOUPE` | `test-recherche-piece`, `test-entreprises-et-sous-traitance-e2e` |
| Importer un tableau CSV ou Excel | **codé ensuite**, après ses trois réponses : son document à part, `docs/importer-un-tableau.md` | | |

## Ce qui a été fait autrement que la planche, et pourquoi

- **La date reste courte** : « 3 oct. 2026 », pas « 3 octobre 2026 ». Une
  suite tient une seule façon d'écrire une date sur cet écran. La loupe trouve
  quand même « octobre ».
- **Un devis sans titre garde son numéro en gras.** Un titre n'est jamais mis
  d'office : en inventer un (le nom du chantier, par exemple) écrirait sur la
  fiche ce que le papier du client ne porte pas. C'est le choix pris faute de
  sa réponse ; il se change en une ligne.
- **Le titre ne prend pas la place du numéro dans les données.** Le numéro
  nomme le fichier qu'il télécharge ; sans cela, un devis arrivait dans son
  téléphone sous le nom `devis.pdf` (`ARCHITECTURE.md` §528).
- **Vos entreprises et Services publics** portent la même phrase que Vos
  clients : leur loupe cherche aussi un titre ou un montant, et « Chercher une
  entreprise » ne le disait plus.
- **La loupe cherche aussi un numéro** (« 2026-000024 ») : la planche ne le
  montrait pas, mais une loupe qui ne retrouve pas le numéro imprimé sur le
  papier passerait pour cassée.
- **Sur Vos clients, taper un nom ne fait pas sortir ses pièces** : le client
  sort déjà dans la liste. Sur sa fiche, au contraire, son nom rend tout son
  dossier, comme sur la planche.

## Ce qui a été dit dans ce lot et qui était faux

- Mon premier contrôle navigateur supposait que la première tâche d'une fiche
  d'essai s'appelait « Tonte » ; le jeu d'essai la nomme « Tonte et
  ébarbage ». L'écran était juste, le contrôle lit maintenant la tâche cochée.
- J'ai tenté d'arrêter mon serveur d'essai par son nom ; c'est interdit
  (`CLAUDE.md` §6) et la session l'a refusé. Arrêté ensuite par son numéro.

## Les chiffres

| Contrôle | Résultat |
|---|---|
| Types, style (fichiers touchés) | verts |
| Suites sans base : `test-recherche-piece`, `test-recherche-client`, `test-documents-du-client`, `test-mode-emploi`, tirets, flèches, pansements, couches, code mort, titres de `TODO.md` | vertes |
| Suites base : `test-fiche-client-db`, `test-liste-clients`, `test-pieces-importees-db`, `test-documents-en-regle-db`, `test-dossier-client-db`, `test-assistant-explique-l-appli` | vertes |
| Suites navigateur des écrans clients, jouées seules (`--seulement`) | **13 sur 13** |
| Mémoire du dépôt | verte |
| **La batterie entière** | **pas jouée**, à sa demande. Elle est obligatoire avant `main` |

Les deux nouveaux contrôles de la liste ont été vus **rouges** sur le code
d'avant, puis verts.

## Ce qui reste ouvert, et qui tranche

| | Qui |
|---|---|
| Jouer la batterie, puis pousser sur `main` | lui, quand ses autres sessions le permettent |
| Importer un tableau : ses trois réponses sont venues (migration oui, SheetJS corrigé, cases vides complétées), et c'est codé : `docs/importer-un-tableau.md` | fait |
| Le défaut « (20 ml) (20 ml) » de la dernière prestation, vu sur sa capture | à chercher, `TODO.md` |
