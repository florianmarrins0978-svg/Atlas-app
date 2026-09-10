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

**UNE AUTRE SESSION TRAVAILLAIT LE MÊME BOUTON LE MÊME SOIR, et il faut le
dire.** Elle a livré sur `main` un journal des écrans traversés, qui corrige
**où** la flèche mène (`ARCHITECTURE.md` §311). Ce lot-ci corrige **par quel
chemin** elle y va.

Le premier jet était une flèche complète, avec son propre souvenir du chemin —
donc une seconde pièce pour le même bouton. **Elle a été jetée à la fusion** :
ce qui reste est une question de plus, posée à l'endroit où l'autre session avait
déjà mis la sienne. Deux règles pour une même question finissent toujours par
diverger, et c'est le patron qui verrait la différence.

Leur paragraphe écarte explicitement `history.back()`, avec trois objections.
Elles tiennent toutes les trois, et aucune n'est contournée :

| leur objection | pourquoi elle ne mord pas ici |
|---|---|
| la flèche est un lien, on l'ouvre dans un onglet | elle en reste un ; seul l'appui simple est intercepté |
| un retour d'historique ment après un rechargement ou un signet | sans marque, on ne recule pas |
| après un enregistrement, il redéposerait sur le formulaire quitté | c'est leur journal qui choisit la destination, et il a retiré ce formulaire |

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

### CE QU'IL A TRANCHÉ, LE SOIR MÊME

Trois pistes lui ont été soumises ; il a choisi la troisième, en un mot :
**« remplace par la dernière chose qui s'est produit »**. C'est fait.

| La règle, en une phrase | **la ligne annonce ce que la FICHE contient** |
|---|---|
| les candidats | les trois registres de sa fiche : Devis, Facture, Fiche |
| les conditions | **les mêmes que la fiche** — devis parti, facture émise, fiche envoyée |
| à jour égal | le plus avancé du parcours : facture, puis devis, puis fiche |
| rien à annoncer | la ligne se tait ; elle n'écrit pas « aucun document » |

**Un chantier ouvert n'en est PAS un**, et c'est le cœur de la correction : il ne
se voit nulle part sur la fiche. L'annoncer aurait recréé le même défaut sous un
autre nom.

**Ce que ça donne à l'écran :** « 10 Rue de Nantes 77400 Lagny-sur-Ma… · Devis
7 sept. »

### TROIS DÉFAUTS SORTIS DE LA CAPTURE, ET D'AUCUN TEST

C'est la cinquième fois dans ce dépôt qu'une image trouve ce qu'un vert cachait.

| Ce que l'image a montré | Ce qui a été fait |
|---|---|
| la date **se coupait** sur les adresses longues — donc elle disparaissait exactement chez les clients où on venait de l'ajouter | l'adresse et la date sont deux boîtes : **l'adresse se rogne, la date jamais** |
| un client sans adresse ni document laissait une **seconde ligne vide** sous son nom | rien à dire, rien à l'écran, et pas même la place |
| « 44300 Nantes· Devis 5 sept. » **collé** — une boîte flexible ne garde pas le blanc qui la commence | le séparateur est une marge, pas un caractère |

**Et l'année tombe quand c'est celle qui court.** Ce n'est pas un goût : ses
quatre caractères sont exactement ce qui faisait déborder la ligne. Sans eux,
elle mesure ce que mesurait « · 8 chantiers », qu'elle remplace — *rien ne se
coupe qui ne se coupait déjà*. Elle reparaît dès qu'elle apprend quelque chose :
« Devis 12 juin 2025 », c'est le client qu'on n'a pas revu.

### Ce qui a été RETIRÉ

Le champ `chantiers` de la fiche : plus personne ne le lisait. Les suites qui
s'en servaient pour éprouver l'isolation et la suppression visent maintenant la
liste des chantiers elle-même — un repère plus profond qu'un compte.

### Un point à savoir, qu'il n'a pas demandé

Le bouton **« Refaire »** d'une fiche client crée le chantier **au moment où l'on
appuie**, même si l'on ne va pas plus loin. C'est probablement une partie de ses
huit.

---

## Ce qui reste ouvert

| Quoi | Qui peut le trancher |
|---|---|
| un retour sert l'écran depuis la réserve (mesuré, pas apporté par ce lot) | **nous** — à ouvrir seulement s'il signale un écran qui ment au retour |

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, 9 septembre 2026, les deux moitiés du lot
ensemble :

| Étape | Résultat |
|---|---|
| Types · Lint · Atelier · Construction · Mémoire · Fournisseurs d'IA | ✅ |
| Données de démonstration · Connexion derrière un proxy | ✅ |
| Suites base de données | ❌ — **1 rouge**, `test-acces-roles` |
| Suites navigateur | ❌ — **16 rouges** |
| **`test-retour-garde-la-place-e2e`** | ✅ **4 / 4** |
| **`test-ligne-du-client-e2e`** | ✅ **5 / 5** |

### LES DIX-SEPT ROUGES SONT EXACTEMENT LES MÊMES QU'AVANT LE LOT

Ce n'est pas une impression : les deux relevés ont été **comparés ligne à
ligne**, celui d'avant le lot et celui d'après.

| | |
|---|---|
| rouges avant | **17** |
| rouges après | **17** |
| ajoutées par ce lot | **aucune** |
| disparues | aucune |

`acces-roles` · `adresse-suggestions` · `anneau-dictee` · `anneau-vers-devis` ·
`carte-reponse-mene-au-geste` · `devis-client` · `fin-de-chantier` · `ia-01` ·
`madame-lucie` · `message-au-client` · `pas-la-ce-jour` · `poser-une-date` ·
`recherche-client` · `reglages` · `reprise-chantier` · `reprise-morceau` ·
`suivi-devis`

**Onze d'entre elles sont nommées dans `TODO.md` depuis le 8 septembre**, et
trois y sont décrites comme des contrôles qui réclament ce qu'il a lui-même fait
retirer (`CLAUDE.md` §5 bis). Elles appartiennent à d'autres lots, et ce
document ne les revendique pas : il dit seulement que **ce lot-ci n'en a ajouté
aucune**.
