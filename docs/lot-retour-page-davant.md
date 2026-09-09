# Le bouton retour — ce qui a été fait, et pourquoi

*9 septembre 2026 · branche `claude/back-button-history-0pa6sj`*

---

## Ce que vous avez signalé

> « J'ai cliqué sur ouvrir le devis, une fois sur le devis je clique sur retour,
> j'arrive sur la page de la fiche client — or le bouton retour doit marcher
> comme un vrai bouton marche arrière : il doit toujours renvoyer à la page d'où
> l'on vient juste avant. »

Vous partiez de l'accueil, par la carte « Devis accepté ».

---

## Ce qui a été trouvé, et c'est le vrai sujet

**C'était la cinquième fois, et toujours la même cause.**

| quand | ce que vous avez signalé | ce qui avait été fait |
|---|---|---|
| 20 août | la fiche client sautait deux écrans | une porte reconnue |
| 31 août | le devis vous déposait sur la fiche du chantier | une destination écrite d'avance |
| 7 sept. | venu du planning, vous atterrissiez sur l'accueil | une porte de plus |
| 8 sept. | venu du planning, le devis menait à la fiche client | une branche de plus |
| **9 sept.** | venu de l'accueil, le devis menait à la fiche client | **ceci** |

Chaque écran **annonçait** sa sortie, écrite le jour où on l'avait écrite. À
chaque fois qu'un nouveau chemin menait à cet écran, l'annonce devenait fausse —
et l'on ajoutait le chemin manquant à la liste. Quatre couches, et la cinquième
était déjà en route.

**Ce qui a été corrigé, c'est la question.** On ne cherche plus à devimer d'où
vous venez : on s'en souvient. Votre onglet garde la trace des écrans traversés,
et **toute** flèche de l'application y lit la page d'avant.

---

## Verdict, point par point

| | verdict | ce qui le fonde |
|---|---|---|
| le retour du devis renvoie où vous étiez | **fait** | `src/lib/journal-de-navigation.ts` |
| **toutes** les flèches, pas seulement celle-là | **fait** | `src/components/atlas/FlecheRetour.tsx` — une seule flèche pour tous les écrans |
| deux retours d'affilée reculent de deux écrans | **fait** | le journal se dépile ; c'était la boucle du 7 septembre |
| recharger la page ne coûte pas un retour de plus | **fait** | le journal survit au rechargement |
| votre règle du 31 août (« toujours la fiche client ») | **gardée, en repli** | elle s'applique quand il n'y a pas de page d'avant |

---

## Ce qui a été fait AUTREMENT que demandé, et pourquoi

**Vous avez dit « comme un vrai bouton marche arrière ». Ce n'est pas
exactement `history.back()` du navigateur, et c'est délibéré sur deux points :**

1. **Un écran qu'on feuillette reste un seul écran.** Sur « TVA », changer de
   trimestre change l'adresse. Avec un vrai bouton retour, il faudrait appuyer
   quatre fois pour quitter l'écran après avoir regardé quatre trimestres. La
   flèche quitte l'écran où vous êtes, d'un coup.
2. **Après avoir enregistré un formulaire, on ne revient pas dessus.** Un vrai
   bouton retour vous remettrait sur la fiche client que vous venez de valider.
   La flèche continue de sortir.

Dans les deux cas, un « vrai » retour aurait été plus fidèle à la lettre et
moins utile. Si vous préférez le comportement strict du navigateur sur ces deux
points, dites-le : c'est une ligne à changer.

---

## Ce qui a été retiré avec — et ce qui aurait manqué sans

**« Aucun client rattaché à ce chantier » n'est plus un cul-de-sac.** Le 31 août,
la flèche du devis avait été détournée vers le formulaire de fiche client
justement parce que cette phrase disait ce qui manquait sans dire où le réparer.
La flèche redevenant un retour, ce chemin aurait disparu.

Il se lit désormais **sous la phrase**, et il s'annonce : « Renseigner la fiche
client ». Il disparaît dès que le client est là — ses coordonnées se corrigent
alors directement sur la feuille du devis.

**Et la fiche d'un client supprimée quitte la trace** : sans cela, la flèche de
l'écran suivant vous aurait déposé sur une fiche effacée.

---

## Ce qui a été REFUSÉ, et ce que ça coûte

**Retirer complètement les quatre anciennes règles de provenance.** Elles ne
servent plus à deviner d'où vous venez — le journal le sait — mais elles servent
encore à deux choses : dire où sortir quand il n'y a pas de page d'avant, et où
aller après avoir enregistré un formulaire.

Leur moitié devenue inutile touche **six écrans et six batteries de contrôle**.
La réécrire la même nuit, c'est livrer rouge. Elle est nommée dans `TODO.md`
avec la liste exacte, et elle a cessé de grandir : plus aucune porte neuve n'a à
s'y déclarer.

**Ce que ça coûte de l'avoir laissée :** quelques centaines de lignes qu'un
développeur lira sans savoir qu'elles ne décident plus de la flèche. C'est
pourquoi elles le disent maintenant en tête, et pourquoi la tâche existe.

---

## DEUX CHOSES QUE J'AI DITES ET QUI ÉTAIENT FAUSSES

Elles sont écrites ici parce qu'un correctif qui a l'air juste et ne l'est pas
coûte plus cher qu'un défaut connu. Les deux ont été trouvées par la batterie,
pas en relisant — et les deux étaient dans MON correctif.

**1. « Le journal sait quand vous reculez. »** Non. Il le devinait à la forme de
la trace — et rouvrir un écran déjà vu laisse exactement la même trace que
reculer. Résultat : la flèche sautait deux écrans en arrière, c'est-à-dire la
panne que je venais de corriger, par l'autre bout.

Reculer ne se devine pas : c'est un geste, et ce sont les trois gestes qui
reculent qui le disent maintenant — l'appui sur la flèche, l'enregistrement
d'une fiche client, et le bouton du navigateur.

**2. « L'ordre des choses n'a pas d'importance. »** Non. La flèche se calcule
avant que le pas ne soit noté : elle lisait donc une trace en retard d'un pas, et
retombait sur la fois PRÉCÉDENTE où vous aviez ouvert le même écran. C'est
exactement votre plainte du 9 septembre, reproduite par mon propre correctif.

**Ce que ça dit du reste :** ni l'une ni l'autre ne se voyait en relisant le
code, et les deux passaient les contrôles « sur papier ». C'est le contrôle qui
déroule VOTRE geste dans un vrai navigateur qui les a nommées.

---

## Ce qui a été éprouvé

| | |
|---|---|
| la règle, sans navigateur | `scripts/test-journal-de-navigation.ts` — 18 cas, tous verts |
| votre geste, dans un navigateur | `scripts/test-retour-page-davant-e2e.ts` — 5 cas, tous verts : accueil → devis → retour → accueil, la même flèche par une autre porte, deux retours d'affilée, la sortie déclarée à froid, et le rechargement |
| les six suites adaptées | vertes ensemble (6/6) |
| la batterie complète | *(les chiffres exacts sont plus bas)* |

**Six batteries de contrôle réclamaient l'ancien comportement** — la flèche du
devis menant à la fiche client. Elles ont été **adaptées, pas contournées** :
chacune défend désormais ce qui ne dépend pas du chemin parcouru (le devis a une
sortie, la fiche montre le bon visage), et la destination est éprouvée là où
c'est son sujet.

---

## Ce qui reste ouvert

| | qui peut trancher |
|---|---|
| les deux écarts avec un « vrai » bouton retour (plus haut) | **vous** |
| la retraite de l'ancienne couche de provenance | nous, quand le journal aura tenu quelques jours chez vous |

---

## À regarder chez vous

Le geste exact : l'accueil, « Ouvrir le devis validé », puis retour. Vous devez
revenir sur l'accueil. Puis le même devis ouvert depuis « Vos clients » : le
retour doit vous ramener chez les clients.
