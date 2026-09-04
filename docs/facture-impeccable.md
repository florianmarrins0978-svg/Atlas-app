# La facture, rendue impeccable — verdict par point

*4 septembre 2026. Lot joué depuis le prompt « Rends impeccable LA FACTURE ».
Le code fait foi ; ce document dit ce qui a été fait, ce qui a été refusé, et ce
qui reste ouvert.*

---

## Ce qui était FAUX dans le brief, et qu'il faut corriger noir sur blanc

**1. « La forme des travaux supplémentaires n'est pas tranchée. »** Elle l'est.
Le 1ᵉʳ septembre 2026 à 01 h 25, trois décisions ont été prises et sont écrites
en tête de `appli/ts-sur-la-facture.html` : le bloc **se déroule sous le
bouton** (l'écran à part est retiré, et l'interrupteur avec), **les raccourcis
de prestations sont retirés**, **tous les boutons s'alignent sur « Envoyer la
facture »**. Le taux se pose à la ligne, et les totaux le ventilent — sans quoi
l'article 268 bis du CGI fait passer toute la facture au taux le plus élevé.

Repartir de zéro sur cette question aurait fait rechoisir quelque chose de déjà
choisi. Ce qui reste réellement ouvert est ailleurs, et se trouve plus bas.

**2. « Le lien du PDF, le Total TTC, le paragraphe gris… »** — les sept
corrections du 24 août sont toutes en place, vérifiées ligne à ligne dans
`FactureClient.tsx` et `TransmettreLaFacture.tsx`. Rien n'a été touché.

**3. Un défaut du brief était SOUS-ESTIMÉ.** Le brief dit que `terminerChantier`
« ne regarde pas s'il existe un devis plus récent ». C'est vrai, et c'est pire :
le cas courant n'est pas de rappuyer sur « Créer la facture », c'est d'ouvrir
l'écran — et `getFacturePourChantier` servait alors le brouillon périmé **sans
un mot**, sur un écran qui ne nommait même pas le devis dont il reprenait les
lignes.

---

## Les trois défauts corrigés

### 1. Le total ne se recomposait pas — et le papier, lui, le décomposait

| | |
|---|---|
| **Ce qui n'allait pas** | l'écran affichait les lignes, puis « Total HT », « TVA X % », « Total TTC ». Ni le **prix accordé au client**, ni les **taux multiples**. Dès qu'une remise existait, la somme des lignes affichées ne faisait pas le Total HT affiché, et rien ne disait pourquoi |
| **Ce qui le prouve** | `src/server/repositories/factures.ts` recopie `reductionPourcent` du devis ; `src/server/pdf/document-commun.ts` imprime « Total HT », la remise et « Total HT après remise », et ventile par taux. L'écran, non |
| **Corrigé** | l'écran appelle `totauxAvecReduction(lignes, tauxTva, reductionPourcent)` — **l'appel exact que fait `emettreFacture` juste avant de figer la pièce**. Ce qu'il voit est ce qui partira |
| **Mesuré** | sur 800 € à 20 % + 400 € à 10 % avec 15 % accordés : 1 200,00 − 180,00 = 1 020,00 ; TVA 20 % 136,00 ; TVA 10 % 34,00 ; TTC 1 190,00. Chaque ligne se refait de tête |

**Les totaux ne sont plus transmis à l'écran du tout.** Ils étaient lus dans les
colonnes de la facture, qui pouvaient prendre du retard sur ses propres lignes.
Une seule règle sert l'affichage et l'émission — `CLAUDE.md` §3.

### 2. Ce que le client ouvre n'était pas votre document

| | |
|---|---|
| **Ce qui n'allait pas** | la page par jeton écrivait `ui-serif, Georgia` en dur et prenait le crème et le vert d'Atlas, pendant que le PDF à un doigt de là portait votre typographie, votre fond, votre accent (migration 0063). Deux pièces pour la même facture, deux allures |
| **Ce qui le prouve** | `src/app/factures/[jeton]/page.tsx` n'appelait jamais `allureDesDocuments` |
| **Corrigé** | l'allure voyage jusqu'à la page (`factureParJeton`), et l'encre suit le fond par la **même règle que le papier** (`encreSurFond`) |
| **L'invariant tenu** | **sans réglage, la page est celle d'aujourd'hui au pixel près** — `allure: null`, et rien ne change. C'est éprouvé |

**Votre charte d'écran, elle, ne fuit toujours pas** : la page en « Nuit » est
identique à la page par défaut, et c'est photographié.

**Ce qui n'a PAS été fait, et le dire vaut mieux que le taire :** l'allure est
lue **au moment de la consultation**, pas figée à l'émission. Si vous changez
votre allure après l'envoi, la page suit et le PDF archivé, non. La figer demande
trois colonnes de plus sur `factures` — voir « Ce qui reste ouvert ».

### 3. Le devis v2 n'atteignait jamais la facture

| | |
|---|---|
| **Ce qui n'allait pas** | une facture bâtie à la fin du chantier garde les lignes du devis d'alors. Un devis corrigé et renvoyé ensuite ne l'atteignait jamais, et le second arrêt se franchissait sur l'ancien prix |
| **Corrigé, en trois pièces** | une règle pure (`src/lib/facture-face-au-devis.ts`) qui **dit** ; l'écran qui **montre**, en nommant le devis et sa version ; un geste — « Reprendre ce devis » — qui **fait** |
| **Refusé** | reprendre automatiquement. Les montants changeraient entre le moment où vous ouvrez l'écran et celui où vous appuyez, sur le seul écran qui engage votre argent |

**Un second défaut a été trouvé en chemin, et il refusait des chantiers
facturables.** `terminerChantier` prenait la **dernière version** du devis, puis
refusait si elle n'était pas envoyée : un devis v1 parti chez le client et une v2
laissée en brouillon rendaient « Le devis de ce chantier n'a jamais été envoyé ».
Phrase fausse, chantier bloqué, aucun geste pour en sortir. Il prend désormais la
dernière version **envoyée** (`lireDevisQuiFaitFoi`), et les deux refus — aucun
devis, aucun devis envoyé — sont distingués.

---

## Deux défauts trouvés SUR LA CAPTURE, et par aucun test

`CLAUDE.md` §5 : *« et surtout, regarder l'écran »*. Cinquième et sixième fois
dans ce dépôt qu'un défaut sort d'une image.

1. **Deux fois le même numéro de devis, l'un dit périmé et l'autre pas.** Les
   versions d'un devis partagent leur numéro commercial : l'écran affichait
   « Reprise du devis 2026-000006 » juste au-dessus de « Le devis 2026-000006 v2
   est parti depuis ». Illisible. La version s'écrit désormais **toujours**,
   même la première — trois caractères lèvent toute l'ambiguïté.
2. **L'écran se contredisait.** Le bandeau annonce qu'un devis plus récent est
   parti, et quatre blocs plus bas l'écran demandait « Rien n'a changé depuis le
   devis ? ». La question se tait quand la réponse est déjà écrite.

---

## Ce qui a été MESURÉ et non corrigé — parce que ça se dessine d'abord

**« Envoyer la facture » finit à 951 px, soit 287 px sous le pli** sur votre
écran de 390 × 664. `scripts/capture-facture-impeccable.mts` le mesure à chaque
passage, et **refuse de conclure sur une boîte de zéro pixel** — une capture
prise avant la mise en page mesurerait 0, et « 0 est au-dessus du pli » serait un
vert qui ne prouve rien (`CLAUDE.md` §5).

**CORRECTION : j'ai d'abord annoncé 309 px, et c'était faux.** Le chiffre venait
d'une capture où le nom du client d'essai passait à la ligne, ce qui ajoutait une
vingtaine de pixels. La mesure refaite bloc par bloc donne 287.

**VOTRE VERDICT DU 4 SEPTEMBRE : « on laisse et on descend comme aujourd'hui ».**
Le bouton ne bouge pas.

Vous aviez d'abord demandé s'il n'était pas possible de **resserrer la page**
pour gagner les pixels manquants. La mesure dit non, et voici pourquoi :

| | px |
|---|---|
| en-tête (retour, « Facture », nom du chantier) | 151 |
| carte Facture + échéance | 123 |
| carte Reprise du devis | 120 |
| **carte des totaux** | **297** |
| « Rien n'a changé depuis le devis ? » | 21 |
| Par SMS / Par e-mail | 84 |
| les cinq espaces entre les blocs | 88 |
| **le bouton finit à** | **951** — pour 664 d'écran |

Espaces à 12 px au lieu de 16, marges de carte à 14 au lieu de 20 : **une
soixantaine de pixels**, contre 287 manquants. Et ces pixels-là ont déjà été
pris — le 31 août, un lot en a récupéré **53 dans les espacements sans retirer un
mot**. Ce qui reste n'est plus de l'air, c'est de la cible sous le doigt, en
plein soleil et à une main.

**La carte qui pèse est celle des totaux, et elle a grossi ce jour-là** : elle
décompose le total au lieu de l'affirmer, ce qui est très exactement la
correction demandée. La resserrer déferait ce qu'on venait de réparer.

---

## Les gestes, comptés

De « le chantier est fait » à « la facture est partie », depuis « Terminés » :

| | Geste | Tombe ? |
|---|---|---|
| 1 | toucher la ligne « À facturer » | non — c'est l'entrée |
| 2 | « Créer la facture » | non — c'est la fin de chantier, un arrêt décidé |
| 3 | *(vérifier les montants)* | rien à appuyer |
| 4 | « Envoyer la facture » | non — arrête la facture, prépare le lien, ouvre la messagerie, en un seul appui |
| 5 | envoyer, depuis votre messagerie | hors d'Atlas, et c'est votre règle |

**Aucun geste ne tombe : ils sont déjà quatre, et chacun décide de quelque
chose.** Ce qui coûte, ce n'est pas un appui de trop — c'est le défilement du
point ci-dessus, et c'est ce que la planche propose de rendre.

---

## Ce qui a été REFUSÉ, et ce que ça aurait coûté

| Refusé | Pourquoi |
|---|---|
| **Un champ de coordonnée avant l'envoi** | vous l'avez écarté le 22 août : *« refuse l'envoi »*. Le canal sans coordonnée reste inerte |
| **Remettre une phrase sous « Facture arrêtée »** | vous l'avez fait supprimer le 24 août. `CLAUDE.md` §5 bis : quand une suite réclame ce que vous avez fait enlever, on corrige la suite |
| **Reprendre le devis automatiquement** | vos montants changeraient sous vos yeux, entre l'ouverture et l'appui |
| **Déplacer « Envoyer la facture »** | apparence : ça se dessine d'abord |
| **Figer l'allure sur la facture** | trois colonnes et une migration, pendant que deux autres sessions écrivent dans le même dossier. À décider, pas à glisser |
| **Toucher la flèche de retour de `facture/page.tsx`** | elle appartient au lot qui retire la fiche du chantier |
| **Corriger `scripts/test-hub-repo.ts`** | il est rouge parce qu'un autre lot a retiré `getSecondarySteps`. Ce n'est pas à moi de le refermer |

---

## Les invariants, tenus

| Invariant | Comment il est tenu |
|---|---|
| **Toute lecture par `withEntreprise`** | `reprendreLeDevisSurLaFacture` et `devisQuiFaitFoi` n'en sortent jamais. Une facture d'une autre entreprise **n'existe pas** pour la requête — éprouvé |
| **La page par jeton s'éprouve en base, sous `atlas_app`** | `scripts/test-facture-reprend-le-devis-db.ts`. Les suites navigateur traversent la RLS et ne voient pas ces défauts — le 8 août 2026, le lien de facture était mort en production pendant que sa suite navigateur était verte |
| **Une facture arrêtée ne se réécrit pas** | la reprise la refuse, en nommant sa raison — éprouvé |
| **Le français partout, les règles pures dans `src/lib/`** | `facture-face-au-devis.ts` est pure et s'éprouve sans base |
| **Jamais deux fois la même règle** | les totaux de l'écran viennent de `totauxAvecReduction`, comme le papier et comme l'émission. L'instantané du devis est écrit une fois (`instantaneDuDevis`) et sert la création comme la reprise |
| **Les huit chartes** | `npx tsx scripts/test-chartes-lisibles.ts` — **14 réussis, 0 échec**. Aucune couleur en clair ajoutée |
| **Aucune flèche décorative** | `npx tsx scripts/test-aucune-fleche.ts` — **115 339 lignes lues, 8 flèches fonctionnelles nommées, aucune décorative** |
| **Un refus nomme sa raison ET son geste** | « Le devis 2026-000006 v2 est parti depuis » + le bouton « Reprendre ce devis » |

---

## Ce qui reste ouvert, et qui peut le trancher

| Point | Qui tranche |
|---|---|
| ~~**A ou B sur la planche**~~ — **TRANCHÉ le 4 sept. : « la A »**, aucun champ de trace | *fermé* |
| ~~**Le geste au-dessus du pli**~~ — **TRANCHÉ le 4 sept. : « on laisse »** | *fermé* |
| ~~**Ce qu'une ligne muette autorise**~~ — sans objet, A ne pose aucune réserve | *fermé* |
| **Figer l'allure des documents sur la facture émise** (trois colonnes, une migration) — pour que la page du client ne bouge plus après l'envoi | **vous**, sur le principe ; moi sur la façon |
| **Les trois suites navigateur que le brief annonce rouges** | mesurées à part, voir ci-dessous |

---

## Ce que ce lot NE couvre pas, et pourquoi

**Trois sessions écrivent dans le même dossier en ce moment.** Au moment de
livrer, l'arbre porte, en plus de ce lot : le retrait de la fiche du chantier
(`src/lib/chantier-etat.ts`, `src/app/chantiers/[id]/…`) et la feuille du
planning (`src/app/planning/…`). Leur travail est **en cours et rouge** :

- `npx tsc --noEmit` échoue sur `scripts/test-hub-repo.ts` (il importe
  `getSecondarySteps`, que l'autre lot vient de retirer) et sur
  `src/app/planning/page.tsx` (une propriété que son composant n'accepte pas
  encore) ;
- `npm run lint` rend 19 erreurs, **toutes dans `src/app/planning/`**.

**Aucune ne vient de ce lot, et aucune n'a été corrigée** : refermer le chantier
d'une autre session dans le même commit rendrait les deux illisibles.

Sur les fichiers de ce lot : `tsc` est propre, `eslint` ne dit rien.

---

## SA CORRECTION DU 4 SEPTEMBRE, ET ELLE ANNULE MA PREMIÈRE PROPOSITION

La première version de la planche portait, sous une ligne de travaux en plus
sans accord écrit : **« Faire signer le bon, ou lui renvoyer le devis. »**

**Il a relevé deux fautes dans cette seule phrase, et les deux sont justes.**

1. *« Depuis cette page, comment l'utilisateur fait pour renvoyer le devis ? »* —
   il ne le peut pas. La phrase désignait un geste qui n'existe nulle part sur
   cet écran. C'est exactement ce que ce lot reproche au reste de l'application :
   un refus qui ne porte pas son geste est un cul-de-sac.
2. *« Les travaux supplémentaires sont là parce que le client les a demandés sur
   le chantier ; il ne va pas lui renvoyer un devis, il doit seulement l'ajouter
   à la facture. »* — et celle-là est plus grave : **le raisonnement était faux**.
   Un devis se fait AVANT le travail. Le travail est fait. Un devis envoyé après
   coup est un papier que personne n'attend, et qui rouvrirait une négociation
   close.

**Ce que cela change dans la façon de poser le problème.** Il n'y a pas
d'« accord manquant » à aller chercher : **l'accord a eu lieu**, de vive voix, au
jardin. Ce qui manque est seulement sa **trace**, et elle ne compte que si la
cliente conteste plus tard.

**La planche est refaite autour de ça.** Quand il ajoute une ligne, un champ dit
qui l'a demandée et quand ; ce qu'il écrit **s'imprime sur la facture**, si bien
que la pièce devient elle-même la trace — et la cliente qui la paie l'accepte.
Une ligne laissée muette part quand même ; l'écran dit seulement ce que sa
cliente lira, et porte le champ, sur cette page.

**SON VERDICT, LE SOIR MÊME : « la A ».** Aucun champ, aucune pastille, aucune
réserve — le bloc des travaux en plus reste exactement celui du 1ᵉʳ septembre.

**C'est la deuxième fois qu'il écarte cette question** (« pas besoin de ça » le
1ᵉʳ septembre), et elle ne se repose pas une troisième. Le risque juridique
reste réel, il le connaît, et **sa réponse est le bon signé sur place**
(`appli/ts-bon-sur-place.html`) — pas un champ de plus sur l'écran de la
facture. Le verdict est écrit en tête de la planche, pour qu'aucune session ne
la rouvre.

Les deux autres pistes, écartées avec elle :

| | Ce que ça donne | Ce que ça coûte |
|---|---|---|
| **Rien du tout** | la réserve disparaît, l'écran se tait | c'est le plus proche de son « pas besoin de ça » du 1ᵉʳ septembre — et la trace reste au bon signé sur place |
| **Le client confirme depuis sa page** | son écran par jeton porte le bloc des travaux en plus et un « Je confirme » daté | la trace la plus solide, et la machinerie existe déjà (le devis s'accepte ainsi). **Mais elle invite à ne PAS confirmer** : elle attire l'œil sur un litige qui n'aurait peut-être jamais eu lieu |

---

## Les chiffres exacts

**Sur les fichiers de ce lot**

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | propre sur ce lot (deux erreurs subsistent, toutes deux à d'autres sessions : `scripts/test-hub-repo.ts`, `src/app/planning/page.tsx`) |
| `npm run lint` | **aucune remarque** sur les neuf fichiers touchés (19 erreurs subsistent, toutes dans `src/app/planning/`) |
| `npm run verifier:memoire` | ✅ 8 fichiers vérifiés, 3 rappels armés |
| `scripts/test-chartes-lisibles.ts` | ✅ **14 réussis, 0 échec** |
| `scripts/test-aucune-fleche.ts` | ✅ 115 339 lignes lues, 8 flèches fonctionnelles nommées, **aucune décorative** |
| `scripts/test-facture-face-au-devis.ts` *(neuf)* | ✅ **5 réussis, 0 échec** |
| `scripts/test-facture-reprend-le-devis-db.ts` *(neuf)* | ✅ **10 réussis, 0 échec** |
| `scripts/capture-facture-impeccable.mts` *(neuf)* | ✅ 7 planches, et la mesure du pli |

**La batterie base : 299/310.** Les onze rouges sont ceux que le dépôt traîne
depuis le 3 septembre — ports, verrous de construction, rôles, fiche du banc :
`test-boutons-arrondis`, `test-fiche-pendant-relance`, `test-mise-a-jour-role-db`,
`test-mode-emploi`, `test-ouvrir-port`, `test-port-remesure`,
`test-relance-construction`, `test-roles-capacites-db`,
`test-salarie-planning-lecture-seule-db`, `test-seed-conserve-identifiants`,
`test-verrou-construction`. **Aucun n'est de ce lot, et aucun ne touche la
facture.**

### Un piège de mesure, payé et consigné

**La même batterie, sur le même code, a rendu 287/310 puis 299/310** à quelques
minutes d'intervalle. Les vingt-trois tombées disaient *« deadlock detected »* et
*« Utilisateur X n'est pas membre de l'entreprise Y »* — la signature d'un
`TRUNCATE` venu d'à côté. `nettoyerBase()` vide la base, et deux batteries
concurrentes se détruisent l'une l'autre.

**Une batterie est une machine à un seul occupant.** Jouée pendant qu'une autre
session travaille, son total ne veut rien dire. C'était déjà écrit dans
`CLAUDE.md` §5 ; ce jour-là, avec trois sessions dans le même dossier, c'est
arrivé pour de bon.

### Les trois suites navigateur du brief : rouges, et pas d'ici

| Suite | Ce qu'elle dit |
|---|---|
| `test-facture-e2e` | **0 réussi, 5 échoués** |
| `test-tva-au-paiement-e2e` | **0 réussi, 7 échoués** |
| `test-facture-au-client-e2e` | non mesurée (délai dépassé) |

**Les cinq et les sept tombent au même endroit, et ce n'est pas la facture :**
`waiting for locator('text=+ Ajouter une ligne')` — l'écran du **devis complet**,
qui ne rend pas son bouton. Aucune des deux n'atteint jamais l'écran de facture.

**Ce lot ne les répare pas, et ne prétend pas le contraire.** Le fichier en cause
(`DevisCompletClient.tsx`) n'est pas touché ici, et l'arbre porte au même moment
deux lots en cours qui réécrivent le chemin d'accès à cet écran. Les rejouer une
fois ces lots posés est dans `TODO.md`.

---

## Les fichiers

**Neufs** — `src/lib/facture-face-au-devis.ts`,
`scripts/test-facture-face-au-devis.ts`,
`scripts/test-facture-reprend-le-devis-db.ts`,
`scripts/capture-facture-impeccable.mts`, `appli/ts-la-trace-de-laccord.html`.

**Touchés** — `src/app/chantiers/[id]/facture/{FactureClient,page,actions}.tsx|ts`,
`src/app/factures/[jeton]/page.tsx`,
`src/server/repositories/{factures,devis,entreprises,envois-factures}.ts`,
`appli/essais.html`.

**Non touchés, volontairement** — la flèche de retour de `facture/page.tsx`
(elle est à l'autre lot), `TransmettreLaFacture.tsx` et les sept corrections du
24 août, `src/server/pdf/*` (le papier était déjà juste — c'est l'écran qui
mentait).
