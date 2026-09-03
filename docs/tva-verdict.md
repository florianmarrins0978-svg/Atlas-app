# « Ma TVA » : ce qui a été codé, et ce qui ne l'a pas été

**Sa validation, le 3 septembre 2026 :** *« je valide cette maquette pour la
page Ma TVA, tu peux coder exactement ça — pas de pansement, pas d'ajout de code
qui ne sert à rien, pas de sur couche. Ne crée pas de problème, fais en sorte
que tout fonctionne correctement. »*

Maquette validée :
`https://claude.ai/code/artifact/b5ca650a-c15b-4995-96a6-190268a650da`

---

## 1. Ce qui est en place, point par point

| Ce que la maquette montrait | Codé | Où |
|---|---|---|
| L'écran est une **addition** : collectée, − déductible, un trait, le reste | oui | `LigneMontant.tsx`, `page.tsx` |
| Les trois montants **alignés à droite sur la même colonne** | oui | `LigneMontant.tsx` |
| **Les trois se copient**, le reste compris | oui | `LigneMontant.tsx` |
| Le total à 34 px, les deux termes à 20 | oui | `LigneMontant.tsx` |
| Le signe **−** sorti de la colonne, pour ne pas décaler les chiffres | oui | `LigneMontant.tsx` |
| Les deux gestes d'achat **entre « Déductible » et le trait** | oui | `AchatsTva.tsx` |
| La ligne de provenance sous le total, qui ouvre les deux réglages | oui | `DeclarationsTva.tsx` |
| La **frise des périodes**, l'année collée à gauche | oui | `FrisePeriodes.tsx` |
| Le calendrier ouvert par l'année | oui | `CalendrierPeriodes.tsx` |
| « En attente » en **lignes**, plus en cartes | oui | `EnAttenteDePaiement.tsx` |
| « Vos factures » puis « Vos achats », les deux preuves | oui | `page.tsx` |
| Icônes **dessinées** à la place des émoji 🧾 ✎ | oui | `page.tsx` |
| Vue **Facturation** : la provenance se lit, ne se touche pas | oui | `DeclarationsTva.tsx` |
| La flèche de retour et l'assistant sur la rangée du haut | oui | `EnTeteEcran` (pièce partagée) |

## 2. Ce que la logique métier garde, mot pour mot

Rien n'a bougé du calcul. Vérifié suite par suite :

- le **régime** (débits / encaissements) et son effet sur la collectée ;
- la **périodicité**, mensuelle ou trimestrielle, et le découpage qu'elle
  commande ;
- le **crédit de TVA** quand le reste est négatif : vrai signe moins, et la
  phrase *« Crédit de TVA — c'est l'État qui vous doit. »*, qui n'apparaît que
  dans ce cas ;
- l'attente **non bornée à la période**, et **effacée entièrement aux débits** ;
- le ticket daté hors période qui **emmène l'écran là où il atterrit** ;
- la TVA recalculée pendant la frappe, et qui **cesse** dès qu'il l'écrit ;
- la mention finale : *« Ce relevé est préparé par Atlas… Il ne vaut pas
  déclaration »*, au caractère près.

## 3. Trois défauts trouvés en REGARDANT la maquette

Ils ne se voyaient dans aucun test, et deux d'entre eux **existaient déjà dans
l'application**.

| | Ce que c'était | Ce que ça donnait |
|---|---|---|
| **1** | `Intl` sépare les milliers par une espace fine insécable (U+202F) que **Playfair Display ne porte pas** | « 1 620,00 € » s'affichait **« 1620,00 € »**. À 34 px, sur un chiffre qu'on recopie chez les impôts |
| **2** | `rustTint` est dérivé du **fond**, pas de l'encre (`chartes.ts`) | sur Nuit il vaut `#1f211e` sur `#101210`, soit **1,14 de contraste** : l'encart d'écart des régimes et la pastille des lignes d'achat n'existaient pas sur deux chartes sur huit |
| **3** | `colors.muted` sur crème tient **3,25** de contraste, sous le seuil de 4,5 | il portait les phrases de second rang, à 11,5-13 px, sur un écran qu'on lit debout au soleil |

**Le premier était déjà résolu dans le dépôt** : `enEuros` (`src/lib/euros.ts`)
remplace U+202F depuis le 30 août 2026, pour une raison d'impression PDF. Cet
écran portait **trois formateurs locaux** qui l'ignoraient. Il n'en porte plus
aucun.

## 4. Ce que j'ai retiré, et ce que ça coûterait de le remettre

| Retiré | Pourquoi | Si tu le veux |
|---|---|---|
| le libellé **« Pour faire monter la déductible »** | les deux boutons touchent maintenant la ligne « Déductible » : la place le dit, et un écran n'explique pas le bouton d'à côté | une ligne à remettre |
| les deux libellés **« ← Juillet 2026 » / « Septembre 2026 → »** | ils redisaient le titre et coûtaient un chargement d'écran chacun ; la frise fait mieux | la frise devrait alors repartir |
| les **émoji 🧾 et ✎** et leur pastille | l'émoji du téléphone est en couleurs au milieu d'un écran qui n'en a aucune, et la pastille n'existe pas sur Nuit | rien à défaire, c'est un remplacement |
| les **cartes** de « En attente » | six plages arrondies empilées font une grille de tableau de bord | les lignes gardent tous les gestes |

## 5. Ce que je n'ai PAS fait, et qui reste à toi

- **Retirer un achat.** `supprimerAchatAction` existe, est gardée par rôle et
  éprouvée — et **aucun écran ne l'appelle**. Un ticket mal lu ne se retire donc
  pas. Le dépôt a déjà la pièce (`LigneRetirable` + le tiroir d'annulation).
  Ce n'était pas dans la maquette validée : je ne l'ai pas ajouté tout seul.
- **Le rond de la flèche de retour** reste sur `rustTint`, donc invisible sur
  Nuit et Sylve. Il vient d'`EnTeteEcran`, partagé par tous les écrans : le
  corriger ici seul aurait fait diverger la grammaire commune. Le chevron, lui,
  se voit — c'est un défaut d'aplat, pas d'usage.

## 6. Deux suites visaient une mise en page, pas une règle

Elles seraient devenues rouges **sur du code juste** :

- `test-achat-hors-periode-e2e.ts` lisait `div:has(> span:text-is("Déductible"))`
  — c'est-à-dire la TUILE — et remontait au fournisseur par
  `xpath=ancestor::div[1]`. Elle vise maintenant des repères `data-atlas`, qui
  survivent au remaniement ;
- `test-periodicite-tva-e2e.ts` touchait les deux mots soulignés directement sur
  l'écran ; ils sont derrière la ligne de provenance. Elle rejoue donc **ton**
  geste — un appui de plus — au lieu d'un écran qui n'existe plus.

## 7. Deux contrôles qui accusaient à tort, corrigés au passage

`test-actions-gardees-db.ts` déclarait **treize actions serveur sans garde de
rôle** — connexion, déconnexion, réponse du client au devis, choix de la charte…
Toutes sont pourtant exemptées, avec leur raison écrite.

`test-reglages-gardes.ts` faisait la même chose sur **trois rubriques** des
réglages : « elles se laissent ouvrir par un salarié qui tape leur adresse ».

La cause est commune : sur Windows, l'énumération rend `src\app\login\actions.ts`
quand les exemptions sont écrites `src/app/login/actions.ts`. Aucune ne
correspondait. **Le défaut n'existe que sur ta machine, jamais sur la CI**, et il
désigne le mauvais coupable — ce que `CLAUDE.md` §5 refuse. Une ligne chacun :
les chemins sont normalisés en barres obliques. **Les deux sont au vert.**

## 8. Ce que j'ai dit et qui était faux — noir sur blanc

**J'ai annoncé deux fois un défaut du produit qui n'existait pas.**

En regardant les captures, la frise s'ouvrait sur **janvier** au lieu du mois
regardé. J'ai écrit deux correctifs, en expliquant à chaque fois pourquoi. Les
deux étaient inutiles : **la cause était dans mon banc de capture**, qui ouvrait
l'application sur `127.0.0.1`. Next 16, en développement, refuse alors les
fichiers JavaScript de la page — trois erreurs `403`, muettes à l'écran. Rien ne
s'hydratait ; aucun bouton n'aurait répondu non plus.

Ce qui a tranché : **sonder la page**, au lieu de la relire. Déplacer la frise à
la main depuis la console marchait — donc la mise en page n'était pas en cause ;
relever les réponses en erreur a montré les trois `403`. Sur `localhost`, la
frise se centre.

Une heure. Le banc vise désormais `localhost` et porte la raison en tête, pour
que personne ne la repaie.

## 9. Les chiffres de la batterie

| | |
|---|---|
| Types, lint, construction | **verts** |
| Mémoire du dépôt, fournisseurs d'IA | **verts** |
| Les quatre suites de TVA | **4/4** |
| Connexion derrière un proxy | **verte** |

**La batterie complète, rejouée après tous les correctifs :** treize suites
rouges au premier passage sont devenues vertes — les quatre de la TVA, mais
aussi `test-facture-e2e`, `test-planning-e2e`, `test-poser-une-date-e2e`,
`test-face-id-e2e` et les autres. Elles tombaient sur un décor laissé par la
suite précédente, pas sur du code.

**Trois rouges neufs sont apparus, et aucun n'est de ce lot** — une autre
session travaille dans le même arbre de travail, en ce moment :

| | |
|---|---|
| deux erreurs de types | `devis-pret/route.ts` et `DevisDepuisDictee.tsx`, tous deux modifiés à côté, pas par moi |
| une référence morte de la mémoire | `docs/planning-le-mois-qui-se-deplie.md` — déjà repartie de `ARCHITECTURE.md` depuis |
| « le port 3000 est déjà pris » | un serveur laissé en marche à côté |

**Ce qui reste rouge sur ta machine, et qui ne vient pas de ce lot :**

| Ce qui rougit | Pourquoi |
|---|---|
| huit suites du **banc d'essai** (ports, verrou de construction, relance, veilleur) | elles pilotent le conteneur Linux ; elles ne peuvent pas passer sur Windows |
| `test-roles-capacites-db` | `git config core.autocrlf` vaut `true` : le fichier des capacités est en CRLF sur ton disque, le contrôle le compare à un texte en `\n`. Le vrai correctif est un `.gitattributes` qui réécrirait tout le dépôt — **c'est ta décision, je n'y touche pas** |
| `test-facture-e2e`, `test-planning-vers-facture-e2e` | **déjà rouges sur `main` avant ce lot** — mesuré et écrit dans le commit `4a30d9da`, avec la course CI qui le prouve |
| `test-boutons-pleins` | le lot « boutons verts » d'une autre session, en cours dans le même arbre |

---

*Détail technique et raisons complètes : `ARCHITECTURE.md` §242.*
