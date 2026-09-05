# Relire sa dictée — la transcription et les informations

*5 septembre 2026 · `/chantiers/[id]/transcription` et `/chantiers/[id]/informations`
· le moment où le patron vérifie qu'on l'a compris, avant de poser ses prix.*

---

## En cinq lignes

Trois défauts, tous de FORME, aucun de calcul. **Un échec de transcription avait
l'allure d'une transcription réussie.** Sur les informations, la proposition et
vos vraies cases portaient **les mêmes mots** et **les deux mêmes tons,
échangés**. Et l'or qui écrit un mot tenait **2,77** là où il en faut 4,5.

Vous avez choisi **« un seul à la fois »** sur la planche, et c'est codé.

> Planche : **https://florianmarrins0978-svg.github.io/Atlas-app/relire-sa-dictee.html**

**La batterie a été jouée** (une seule, pour vos deux sessions à la fois) et les
**captures sont prises**. Elles ont attrapé trois défauts que rien d'autre ne
voyait — c'est plus bas.

---

## Les trois défauts, et ce qui a été fait

### 1. Cinq états de transcription dans le même paragraphe

**Le fichier qui le fonde :** `transcription/page.tsx`, l. 30-68 de la version
d'avant.

Le vrai texte de votre dictée, « Aucune note vocale », « Transcription en
cours… », l'échec et l'excuse du texte non transcrit sortaient **du même `<p>`,
dans la même plage** — seule la couleur changeait, encre ou gris.

L'écran portait pourtant déjà le commentaire qui l'interdisait — *« un texte de
remplacement n'est pas une transcription »* — mais il ne visait que le CONTENU.
La forme, elle, disait l'inverse.

**Ce qui a été fait :** la plage ne porte plus que vos mots. Tout le reste se
pose sur le fond de page, avec le geste qui débloque.

| État | Ce que l'écran fait maintenant |
|---|---|
| **écoutée** | la plage, puis le devis d'un geste, puis « corriger le texte » |
| **en cours** | les trois points qui respirent — **et l'écran se met à jour tout seul** |
| **échouée** | « Échec » en rouge, la cause, puis relancer ou écrire |
| **non transcrite** | la case d'écriture s'ouvre d'elle-même, sans renvoyer à la note vocale |
| **aucune note** | un seul geste, en bouton plein |

**Trouvé au passage, et réparé :** l'état « en cours » était un cul-de-sac —
aucune sortie, aucun rafraîchissement. Il fallait savoir qu'il fallait revenir.

**Fait autrement que sur la planche :** l'attente n'est pas le filet d'or que je
vous avais dessiné, mais les **trois points** déjà employés partout dans
l'application. Deux raisons : un filet pleine largeur sous un titre EST le trait
que vous avez fait retirer partout le 25 août — il le redevient dès que
l'animation s'arrête —, et une seconde façon de dire « ça travaille » aurait
divergé de la première.

### 2. La proposition et la donnée acquise se ressemblaient

**Les fichiers qui le fondent :** `BrouillonSection.tsx` l. 256-289 et
`InformationsClient.tsx` l. 133-183, version d'avant.

L'écran écrivait **deux fois** « Prestations », « Durée », « Équipe »,
« Matériel ». La seule différence était un fond — et c'était le pire cas
possible : la case du brouillon était **crème dans une plage claire**, la vraie
case **claire sur fond crème**. Les deux mêmes tons, échangés. À l'œil, sur un
téléphone en plein soleil, cela ne distingue rien.

**Votre choix, « un seul à la fois », est codé tel quel :** vos cases
n'apparaissent qu'une fois le brouillon confirmé, déjà remplies, et tant qu'il
reste quelque chose à confirmer l'écran ne porte **qu'un seul bouton**.

Trois garde-fous ont été ajoutés, sans lesquels la règle aurait nui :

| | |
|---|---|
| ce qui porte **déjà** quelque chose n'est jamais caché | un chantier commencé à la main puis dicté aurait vu ses lignes disparaître, et vous les auriez crues perdues |
| « Écrire les lignes à la main » | ouvre les cases sans rien confirmer, et sans effacer la proposition |
| « Valider et calculer le prix » | ne s'affiche plus tant qu'un brouillon attend : il proposait de sauter par-dessus la confirmation, et ce qui avait été entendu ne rejoignait jamais le chantier |

**Et les trois notes sortent de l'encart** — déchets, contraintes d'accès,
remarques. Elles sont à vous, pas à la machine : aucune autre case ne les porte,
et elles restent quand tout le reste a été recopié dans le chantier. Dans
l'encart, elles avaient l'air de partir avec lui.

### 3. L'or qui porte un mot ne se lisait pas

**Mesuré**, sur Origine :

| | |
|---|---|
| `or` sur le fond de page — « Écrire le devis » | **2,77** |
| `or` sur une plage — « À confirmer » | **2,91** |
| `orTexte`, le jeton posé le matin même par l'écran des prix | **4,59** et **4,83** |

Les trois passent à `orTexte`. **L'or des traits ne bouge pas** : le cheveu de
l'avertissement, celui de l'encart. Ce n'est pas la charte qui repeint l'or —
votre consigne du 31 août tient —, c'est le rôle qui change de jeton : un mot
qu'on lit, et non un trait qu'on regarde.

---

## Aussi trouvé, et réparé dans le même lot

| | |
|---|---|
| `rgba(20,18,14,0.35)` écrit en clair sur le voile du tiroir « Remplacer vos corrections ? » | **quatrième retour** de la faute du 22 août. Sur Nuit et Sylve, du sombre sur du sombre, au-dessus du seul geste irréversible de l'écran. Passé à `voile(colors.ink, 0.35)` |
| « aucun prestataire de transcription n'est encore raccordé », dans **quatre** paragraphes | c'était vrai en juillet ; vos clés sont posées depuis le 6 août (`docs/A-FAIRE.md` §1). L'application vous disait qu'elle ne savait pas faire ce qu'elle fait tous les jours. **La phrase est retirée, rien ne la remplace** |

---

## Ce que j'ai décidé seul, et ce que ça coûte

**J'ai codé la transcription sans votre accord explicite.** Vous avez répondu
sur les informations ; la question de la plage est restée sans réponse. Ce
n'était pas une affaire de goût — un échec qui a l'allure d'un succès est un
défaut —, et la forme est exactement celle de la planche que vous avez ouverte.
**Si elle ne vous plaît pas, elle se défait sans toucher au reste.**

**« Écrire le devis » reste affiché en toutes circonstances**, brouillon en
attente compris. Ma propre planche l'omettait : c'est la planche qui avait tort.
C'est la sortie de secours que vous avez demandée le 3 août 2026, et elle ne se
retire pas parce qu'un autre geste est proposé.

**« Aucune note vocale pour ce chantier. » est gardée mot pour mot**, alors que
la planche la raccourcissait en « Aucune dictée sur ce chantier. » : c'est le
terme de l'application, celui du bouton juste en dessous, et une suite l'éprouve.

---

## Ce qui a été refusé, et ce que ça aurait coûté

| Refusé | Pourquoi |
|---|---|
| **Découper `informations/actions.ts`** (1 083 l.) | Ça ne change rien pour vous, et déplacer mille lignes pendant que d'autres sessions poussent sur `main`, c'est du travail jeté sur un conflit |
| **Éclaircir `muted`** (3,49, sous le seuil) | C'est VOTRE niveau, choisi sur planche, et `test-chartes-lisibles.ts` refuse délibérément de l'exiger |
| **Une relance de transcription sur cet écran** | Deux endroits pour lancer la même chose, c'est un de trop |
| **Toucher aux 124 suites bout-en-bout** | La session voisine les modifie toutes en ce moment. Leurs libellés ont donc été préservés au mot près, plutôt que corrigés après coup |
| **Toucher à `prix/`, au devis, à la facture, à la note vocale** | D'autres sessions y sont |

Rien de ce que vous aviez tranché n'a été rouvert : les cases s'écrivent après
confirmation, ce qui est recopié disparaît de l'encart, les trois phrases grises
du 25 août ne reviennent pas, les réserves restent à cinq et annoncent le reste,
le mot « équipe » ne s'écrit pas à une seule équipe.

---

## Ce que les captures ont attrapé, et qu'aucun test ne voyait

Trois défauts, tous trouvés en REGARDANT les dix-huit images — pas un seul par
une suite verte. C'est la cinquième fois dans ce dépôt.

| | |
|---|---|
| dans l'état « échec », **« Écrire ce que j'ai dit » était centré** sous « Relancer depuis la note vocale », aligné à gauche | deux gestes de même rang, deux alignements |
| les **trois points d'attente partaient au milieu de l'écran**, seuls, loin de leur phrase | `.atlas-souffle` est un conteneur flex qui centre : posé dans un bloc pleine largeur, il centre sur toute la largeur |
| **« Entendu » s'écrivait avant que rien n'ait été entendu** — au-dessus de « Générez un brouillon structuré » | le mot annonçait une lecture qui n'avait pas eu lieu ; la rangée disparaît maintenant avec lui |

Le script qui les a prises est dans le dépôt et se rejoue :
`npx tsx --env-file=.env scripts/capture-relire-sa-dictee.mts`. Il POSE les six
états de la dictée dans la base — ils ne s'atteignent pas en cliquant — puis
photographie, sur Origine et sur Nuit. Il rend l'apparence comme il l'a trouvée.

---

## Les chiffres

| | |
|---|---|
| `npx tsc --noEmit` | **0 erreur** |
| `npm run lint` | **0 erreur**, 18 avertissements — **aucun** dans les fichiers de ce lot |
| `test-etat-transcription.ts` (neuve) | **10 contrôles, 0 échec** |
| `test-aucune-couleur-en-clair.ts` (neuve) | **6 écrans, 1 361 lignes, 0 faute** |
| `test-chartes-lisibles.ts` | **14 réussis, 0 échec** |
| `test-aucune-fleche.ts` | **116 574 lignes, aucune flèche décorative** |
| `test-brouillon-reserves.ts` | **6 réussis** |
| Les deux suites neuves confrontées à l'état dégradé | **rouges, et sur le bon coupable** |

## La batterie complète — jouée une fois, pour les deux sessions

Deux batteries en même temps se cassent l'une l'autre : même base, même port.
Une seule les couvre toutes les deux, puisque nous travaillons dans le même
dossier.

| Étape | |
|---|---|
| Types, lint, mémoire | **vertes** |
| Suites base de données | **304 / 314** |
| Suites navigateur | **115 / 128** |
| Connexion derrière un proxy | **a refusé de mesurer** — le serveur n'a pas répondu en dix minutes (construction comprise) |

**Les six suites qui couvrent ces deux écrans sont VERTES**, et ce sont celles
qui comptent ici :

```
test-transcription-e2e   ✅      test-etat-transcription        ✅ 10/10
test-informations-e2e    ✅      test-aucune-couleur-en-clair   ✅
test-brouillon-e2e       ✅      test-ia-01-e2e                 ✅
```

**Les 23 suites rouges, et ce que j'en sais exactement.** Aucune ne nomme un
fichier de ce lot. Deux d'entre elles accusent le travail EN COURS de votre
autre session, pas encore enregistré :

| | |
|---|---|
| `test-mode-emploi` | « Par SMS » et « Par e-mail » ne sont plus dans `FormulaireNouveauChantier.tsx` |
| `test-boutons-arrondis` | un bouton à angles droits dans `ChoixCanal.tsx` |

Quatre autres (`test-fiche-pendant-relance`, `test-verrou-construction`,
`test-relance-construction`, `test-ouvrir-port`) sont **écrites comme déjà
rouges** dans `TODO.md` depuis le 29 août. Les treize suites navigateur
restantes tombent sur le devis, le planning, la page du client et le calendrier
— aucune sur la transcription ni sur les informations.

**Ce que je ne peux PAS affirmer :** que les vingt-trois rougissaient déjà avant
ce lot. Le prouver demanderait de rejouer la batterie sur le code d'avant, et
l'arbre porte le travail non enregistré de votre autre session — on ne peut pas
revenir en arrière sans le mettre en danger.

---

## Ce qui reste ouvert, et qui peut le trancher

| | Qui |
|---|---|
| La forme des cinq états de la transcription vous convient-elle ? | **vous**, sur les captures |
| Une fois confirmé, vos trois notes (déchets, accès, remarques) se lisent AVANT les prestations. Est-ce le bon ordre ? | **vous** — je les ai gardées près de l'encart, parce qu'elles viennent de la dictée |
| Les treize suites navigateur rouges sur le devis, le planning et le calendrier | les **sessions** qui tiennent ces écrans |
| `Calendrier.tsx` et ses trois couleurs écrites en dur | la **session de l'écran de date**, déjà prévenue |
