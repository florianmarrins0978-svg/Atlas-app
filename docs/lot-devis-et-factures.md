# « Devis & factures » — lot 3

**6 septembre 2026.** Troisième lot de la reprise des Réglages, même consigne
que les deux premiers :

> *« Imagine que la plupart des patrons qui vont utiliser l'app sont des vieux
> qui ont du mal à se servir de leur téléphone. »*

**La planche à ouvrir :**
`https://florianmarrins0978-svg.github.io/Atlas-app/devis-et-factures.html`

Touchez les interrupteurs, puis basculez sur **« Aujourd'hui »** : le défaut se
voit tout seul.

---

## Ce que j'ai mesuré avant de toucher quoi que ce soit

À 390 × 664, dans un navigateur :

| | |
|---|---|
| hauteur de l'écran | **4 237 px**, soit **6,4 écrans** |
| mots | **589** |
| choses à toucher | **39** |

Et pendant qu'on règle l'allure, trois bandes collées prenaient **392 px des
664** : l'aperçu du devis (259), la barre d'enregistrement (85), la barre du
bas (48). **Il restait 272 px pour lire** — 41 % de l'écran.

---

## Le défaut, et il est sur le PREMIER écran

La barre « Enregistré ✓ » était rendue **en permanence**, opaque, même quand
elle n'avait rien à enregistrer. Le contenu passait dessous : dès l'arrivée sur
l'écran, elle coupait **« Moyens de paiement acceptés » en deux, son
interrupteur compris**. Un réglage qu'on ne peut pas viser.

**Elle ne servait qu'à un seul bloc.** Tout le reste de cet écran s'enregistre
seul — chaque interrupteur, l'allure, le format des numéros —, et l'écran
l'écrit lui-même : *« Enregistré au fur et à mesure »*. Une barre permanente
pour un bloc, qui recouvrait les cinq autres.

**Aucun test ne pouvait le voir**, et ce n'est pas un reproche aux suites : elles
cliquent des réglages, elles ne mesurent pas ce qui recouvre quoi. C'est la
capture qui l'a montré — la cinquième fois dans ce dépôt.

---

## Ce que j'ai corrigé

**1. La barre n'apparaît que s'il y a quelque chose à enregistrer.** Elle revient
d'elle-même dès que vous touchez au message, affiche « Enregistré ✓ » deux
secondes et demie après l'envoi, puis rend la place. Rien ne se découvre, rien
ne se devine.

**2. « Ce que votre devis dira » est remonté sous les interrupteurs qu'il
résume.** Ce récapitulatif porte sur les six premiers réglages et vivait
**3 000 px plus bas**, après le message, le numéro et l'allure. On le lisait
sans savoir de quoi il parlait, ou — quatre écrans plus loin — on ne le lisait
jamais.

### Ce que ça donne

| | Avant | Après |
|---|---|---|
| hauteur de l'écran | 4 237 px | **4 117 px** |
| en écrans de 664 | 6,38 | **6,20** |
| bandes collées, dans l'allure | 392 px | **307 px** |
| **ce qu'il reste pour lire** | **272 px** | **357 px** |
| le récapitulatif est à | 3 803 px | **756 px** |
| réglages entiers sur la première fenêtre | 3 et demi | **5** |

---

## Ce que je n'ai PAS touché, et pourquoi

**Rien n'est sorti de cet écran.** Tout ce qui y vit y est parce que vous l'avez
demandé, planche en main :

| Ce qui est ici | Votre réponse |
|---|---|
| l'allure — logo, typographie, couleurs | **B**, le 23 août : *« ici et pas dans une rubrique à part »* |
| le message au client | **A**, le 23 août |
| l'aperçu qui reste collé pendant qu'on règle | **B**, le 25 août, après trois rangements montrés |
| le format de numéro | votre demande du 26 août |

Trois contrôles du dépôt tiennent ces décisions, et c'est très bien : ils
m'auraient arrêté si j'avais essayé.

---

## Ce qui reste sur la table — et c'est vous qui tranchez

**1. L'écran restera long : 6,2 écrans.** Mes corrections rendent de la place,
elles ne raccourcissent pas la page — raccourcir voudrait dire sortir quelque
chose d'ici, et vous avez décidé deux fois le contraire.

Ce que je veux vous dire sans le décider à votre place : **ces deux décisions
ont été prises quand l'écran portait deux blocs. Il en porte six.** Si vous
voulez qu'on le coupe — les conditions d'un côté, l'allure de l'autre —
dites-le, et ce sera un lot à part. Sinon on n'y touche plus.

**2. Deux façons d'enregistrer dans le même écran.** L'allure s'écrit toute
seule ; le message attend un bouton. Les unifier demande de choisir laquelle des
deux, et ce n'est pas une correction de mise en page.

**3. L'aperçu collé recouvre le contenu qui passe dessous** — « Mon logo »,
« Aucun », « Choisir une image » lui passent sous le nez pendant le
défilement. C'est le prix de votre réponse B, et je ne l'ai pas touché : c'est
votre choix, pas un défaut. Vous savez maintenant ce qu'il coûte.

---

## Un contrôle ajouté, et un cas RETIRÉ plutôt que livré vert

**Ajouté :** `scripts/test-barre-enregistrer-e2e.ts` — la barre n'existe que
quand elle sert, et elle revient dès qu'on touche au message. Il sait échouer :
remise en permanence, le premier cas rougit ; jamais rendue, le second.

**Retiré :** un troisième cas, « aucun réglage n'est recouvert par une bande
collée ». Écrit d'abord comme une comparaison de position, il rendait le
**même verdict avec et sans le défaut** — une barre posée par-dessus ne déplace
rien, elle recouvre. Réécrit sur le vrai recouvrement, il n'avait plus rien à
mesurer en haut de l'écran ; et plus bas, il aurait rougi sur l'aperçu collé,
c'est-à-dire sur votre décision.

**Je ne livre pas un contrôle qui ne peut pas mesurer.** Le recouvrement est
mesuré à la main, et ses chiffres sont plus haut.

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, jouée en entier sur votre poste.

| Étape | Résultat |
|---|---|
| Types, lint, construction, mémoire | **verts** — 0 erreur |
| Suites base de données | **305 / 314** |
| Suites navigateur | **117 / 130** |
| Connexion derrière un proxy | **n'a toujours pas mesuré** — la panne d'outillage Windows signalée hier |

**Les six suites de cet écran sont vertes**, nommément :
`test-barre-enregistrer-e2e` (celle de ce lot),
`test-allure-de-mes-devis-e2e`, `test-message-au-client-e2e`,
`test-format-numero-e2e`, `test-apercu-colle-e2e`, et `test-reglages-e2e`.

**Les neuf rouges en base sont les mêmes qu'hier**, tous de machine.

**Treize rouges au navigateur**, et voilà ce que la comparaison avec la
batterie d'hier montre — c'est plus utile que le total :

| | |
|---|---|
| **disparus tout seuls** | `test-arrosage-e2e`, `test-brouillon-e2e`, `test-feuille-envoi-lisible-e2e` — rouges hier, verts aujourd'hui, sans que rien ait changé chez eux |
| **apparu tout seul** | `test-planning-e2e`, qui ne cite pas une seule fois cet écran |

**Des rouges qui vont et viennent sur le même code, ce sont des suites qui se
gênent sous la batterie**, pas des défauts du produit — c'est déjà consigné dans
`TODO.md` depuis le 26 août. Je ne les compte donc pas comme des régressions, et
je ne les compte pas non plus comme réglés.

---

## Ce qui reste des Réglages

| Lot | Quoi |
|---|---|
| 4 | « Mon entreprise » — le régime de TVA et sa périodicité séparés par le bloc bancaire |
| 5 | « Mon agenda » — Google demande un identifiant OAuth, iCloud un mot de passe d'application. **Les deux sont hors de portée, et c'est vous qui tranchez** |
| 6 | Équipe (proposition C), notifications, mot de passe, données, couleurs, IA, abonnement, compte |
