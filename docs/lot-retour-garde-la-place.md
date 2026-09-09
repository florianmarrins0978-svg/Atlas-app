# La flèche de retour rend sa place — et ce que « 8 chantiers » veut dire

*9 septembre 2026. Deux points signalés dans le même message, capture de « Vos
clients » à l'appui.*

---

## Ses deux points, et le verdict de chacun

| Son point | Verdict | Ce qui le fonde |
|---|---|---|
| **1.** *« Si je clique sur un client tout en bas de la liste, je fais retour, il me remet en haut de la liste. Je veux rester où j'étais ! »* | **défaut réel, reproduit, corrigé** | `src/components/atlas/FlecheRetour.tsx` |
| **2.** *« À quoi correspond le nombre de chantier ? Certains clients ont 8 chantiers, on s'attend à avoir 8 devis alors qu'il y en a 0 »* | **le compte est juste — c'est ce qu'il annonce qui trompe** | `src/server/repositories/fiche-client.ts`, `src/lib/fiche-client.ts` |

---

## 1. La place perdue au retour

### Le défaut n'était pas dans la liste des clients

La flèche de retour de **tous** les écrans (`EnTeteEcran`) était un lien —
c'est-à-dire une navigation **en avant** vers l'adresse de l'écran précédent.
Next.js pose une page neuve en haut, et il a raison : c'est ce qu'on attend d'un
lien. Mais le geste, lui, est un **retour**.

Chercher le défaut dans la liste aurait conduit à lui écrire une mémoire de
défilement à elle — une seconde vérité à côté de celle que le navigateur tient
déjà, et un pansement sur une flèche qui serait restée fausse partout ailleurs.

### La mesure, faite AVANT de corriger

Version bâtie, son écran (390 × 664), quarante-sept clients descendus jusqu'au
bout :

| Le geste | Où l'on retombe |
|---|---|
| la flèche de l'écran | **0 px** |
| le retour du navigateur | **2 941 px** — sa place exacte |

Le navigateur savait donc déjà le faire. Il n'y avait rien à inventer : il
fallait cesser de l'en empêcher.

### Ce qui a été fait

La flèche **recule** dans l'historique — mais seulement quand l'écran d'avant est
bien celui qu'elle vise. Chaque entrée d'historique est marquée de l'adresse d'où
elle a été ouverte ; sans marque, la flèche navigue comme avant.

**Pourquoi cette prudence :** une fiche ouverte depuis un signet, ou rechargée,
n'a pas d'écran d'avant. Y reculer à l'aveugle ferait un bouton qui ne fait rien
— ou qui rendrait la main au site précédent.

**Où la flèche mène n'a pas bougé d'un pouce** : c'est toujours la règle de
provenance qui le décide (`ARCHITECTURE.md` §296). Ce lot ne change que le
**sens** dans lequel on parcourt le chemin.

### Ce que le correctif RETIRE

L'entrée d'historique empilée à chaque aller-retour. Il fallait auparavant
appuyer sur le retour du navigateur autant de fois qu'on avait ouvert de fiches
pour ressortir de la liste. *Un correctif qui n'enlève rien doit alerter ;
celui-ci enlève une navigation.*

### Ce qui a été ÉCRIT PUIS RETIRÉ, et pourquoi il faut le dire

Le contrôle a montré autre chose au passage : **un retour sert l'écran depuis la
réserve de Next.js**. Une donnée changée en base pendant qu'on était sur la fiche
n'apparaît pas au retour.

Ce n'est **pas ce lot qui l'apporte** — le même contrôle joué sur le retour du
navigateur, celui qu'il emploie déjà sur son téléphone, est stale exactement
pareil, et depuis toujours.

Un rafraîchissement automatique a donc été écrit, essayé, **puis jeté** : il
rendait les données fraîches et remettait le défilement à zéro, c'est-à-dire
qu'il défaisait le correctif qu'on venait de livrer. Le faire tenir demandait
d'attendre 400 millisecondes que le navigateur ait fini de restaurer — un
pansement au sens exact de la règle d'or, qui serait revenu sur un téléphone plus
lent. Le point ouvert et sa mesure sont dans `TODO.md`.

### Le contrôle sait échouer

`scripts/test-retour-garde-la-place-e2e.ts` déroule le geste entier — descendre,
ouvrir un client, revenir — et vise la **règle** : une position de défilement,
une adresse. Rien qui réclame un mot qu'il pourrait faire retirer demain.

| Contre la version d'avant | Contre celle-ci |
|---|---|
| ✗ « on est resté » — *0 px au lieu de 17 641* | ✓ |
| ✗ « l'aller-retour n'empile plus d'historique » | ✓ |
| ✓ les deux garde-fous | ✓ |

Il pose lui-même ses trente clients — **et aucun chantier** : sur le jeu de
démonstration la liste tient dans l'écran, et le contrôle mesurerait alors
**zéro**, en vert.

---

## 2. « 8 chantiers », et pourquoi il n'y a pas 8 devis

### Ce que le nombre compte, exactement

**Tous les chantiers rattachés à ce client**, quel que soit leur état, les
supprimés exclus. Un chantier naît dès qu'on en ouvre un — une dictée, « Nouveau
chantier », « Autre chantier » depuis sa fiche — c'est-à-dire **avant** qu'il y
ait le moindre devis.

### Ce que la colonne « Devis » compte, et ce n'est pas la même chose

**Seulement les devis PARTIS** (envoyés au client). Un devis préparé, chiffré,
mais jamais envoyé n'apparaît nulle part sur la fiche : il n'a pas de numéro
définitif, le client ne l'a jamais reçu.

### Donc, sur son écran

> « 8 chantiers » et « Aucun devis parti » veut dire : **huit chantiers ouverts,
> aucun devis envoyé.** Rien n'est perdu, rien n'est cassé.

Le compte est donc juste. Ce qui trompe, c'est qu'il **promet plus qu'il ne
dit** : rien sur la ligne n'annonce qu'un chantier peut être vide.

### Ce qui n'a PAS été fait, et pourquoi

Aucune ligne n'a été changée sur cet écran. C'est une question d'apparence, et la
règle du dépôt est claire : **maquette d'abord, code ensuite**. Trois pistes
existent, elles ne coûtent pas la même chose, et c'est à lui de choisir :

| Piste | Ce qu'elle donne |
|---|---|
| garder « 8 chantiers » | on ne touche à rien ; il sait maintenant ce que ça compte |
| ne compter que ce qui a produit quelque chose | le nombre devient une promesse tenue — mais un chantier en cours disparaît du compte |
| remplacer le compte par la dernière chose qui s'est passée | « Dernier devis · 7 sept. », ou rien du tout |

**Il n'y a pas de bonne réponse sans lui** : le compte sert à distinguer deux
clients du même nom autant qu'à dire combien de travail on leur a fait. Une
maquette se dessine en une heure dès qu'il dit lequel des trois il veut regarder.

---

## Ce qui reste ouvert

| Quoi | Qui peut le trancher |
|---|---|
| ce que « 8 chantiers » doit dire sur la ligne d'un client | **lui** — maquette d'abord |
| un retour sert l'écran depuis la réserve (mesuré, pas apporté par ce lot) | **nous** — à ouvrir seulement s'il signale un écran qui ment au retour |

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, 9 septembre 2026 :

| Étape | Résultat |
|---|---|
| Types · Lint · Mémoire · Construction · Fournisseurs d'IA | ✅ |
| Suites base de données | **1 rouge** — `test-acces-roles` |
| Suites navigateur | **121 / 137** |
| Connexion derrière un proxy | ✅ |
| **La suite de ce lot** | ✅ **4 / 4** |

### Les seize rouges, un par un — AUCUN n'est de ce lot

**Onze étaient déjà nommés dans `TODO.md` au 8 septembre** : `adresse-suggestions`,
`anneau-dictee`, `anneau-vers-devis`, `carte-reponse-mene-au-geste`,
`devis-client`, `ia-01`, `message-au-client`, `recherche-client`,
`reprise-chantier`, `reprise-morceau`, `suivi-devis`.

**Six ne l'étaient pas, et chacun a été vérifié plutôt que supposé :**

| Suite | Ce qu'elle dit | Verdict |
|---|---|---|
| `acces-roles` | une route de plus dans la liste attendue : `…/facture/travaux-supplementaires` | le lot « travaux supplémentaires », lisible dans l'écart |
| `reglages` | « Sans clé, l'écran doit annoncer le mode déterministe » | **rouge AVEC et SANS ce lot** — rejoué dans les deux sens |
| `fin-de-chantier` | aucune `ligne-planifiee` au planning | **rouge AVEC et SANS ce lot** — rejoué dans les deux sens |
| `madame-lucie` · `pas-la-ce-jour` · `poser-une-date` | dictée, recouvrement, pose d'une date | **vertes AVEC comme SANS**, jouées à conditions égales : leur rouge tient à la batterie entière (une centaine de suites accumulées avant elles), pas à ce lot |

**La méthode, et elle vaut d'être dite :** les six ont été rejouées deux fois
dans le MÊME filtre, une fois le lot retiré de l'arbre, une fois remis. Deux
mêmes résultats, à conditions égales. Comparer un rouge de batterie à un vert
joué seul n'aurait rien prouvé — c'est le piège du 20 août 2026, où une suite
passait seule et tombait en batterie pour une raison qui n'avait rien à voir.

### Un défaut de MA suite, trouvé et corrigé avant la poussée

Sa première version posait **trente chantiers planifiés** pour dater ses
clients. La base des suites navigateur est commune et s'accumule : trente
chantiers de plus au planning, et le rouge serait tombé sur une suite jouée
après celle-ci, sur du code juste. Les chantiers ont été retirés — un client
sans chantier se range en fin de liste, c'est tout ce qu'il faut ici.
