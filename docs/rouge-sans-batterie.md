# Corriger un rouge coûtait cinquante minutes

**17 septembre 2026, 23 h.** Ta phrase : *« ça recommence et c'est ça à chaque
fois ! »*, devant une session qui repartait pour une batterie entière après
avoir corrigé **une ligne de documentation**.

## Ce que tu as vu, et pourquoi ça bouclait

La batterie finit : **158 suites vertes sur 159**. Deux rouges seulement — un
rouge de documentation (à corriger en trois secondes) et un rouge venu de
`main`. La session corrige la documentation. Et elle repart pour cinquante
minutes.

**Deux murs, et aucun ne se voyait depuis la conversation :**

| Le mur | Ce qu'il imposait |
|---|---|
| une étape qui n'est **pas** une suite — Types, Lint, **Mémoire du dépôt**, Construction — ferme la fusion à elle seule | et **rien ne savait la rejouer seule** : la liste des étapes vivait à l'intérieur du script de la batterie, qui ne sait faire que tout |
| le rattrapage d'après-fusion refusait **dès que le lot avait changé** | or corriger un rouge, c'est changer le lot : il ne servait jamais au moment où il fallait |

Le seul chemin restant était donc la batterie complète — dont le produit est le
rouge suivant. C'est la boucle, et elle était mécanique.

## Ce qui a été corrigé, à la racine

**La liste des étapes est sortie du script de la batterie.** Elle vit
maintenant à part, et deux commandes la lisent : la batterie, qui les joue
toutes, et le rattrapage, qui en joue **une**.

```bash
npx tsx scripts/verifier-ce-qui-a-bouge.ts
```

Il répond à une seule question : **qu'est-ce qui a bougé depuis la mesure, et
que peut-il casser ?**

| | |
|---|---|
| ce qui a bougé | lu par le **contenu** — y compris un `.md`, que l'empreinte n'indexait pas. C'est exactement là que vivait ton rouge |
| ce qu'on rejoue | ce qui était rouge, **plus** ce que la correction peut casser |
| ce qu'on ne rejoue pas | **garde son rouge** — ne pas savoir n'est jamais vert |
| quand il refuse | quand ce qui a bougé est trop large (migration, configuration) : là, c'est la batterie, et c'est justifié |

Ton cas — un rouge « Mémoire du dépôt » corrigé dans un document — rejoue
désormais **trois étapes** : Types, Lint, Mémoire du dépôt. Quelques minutes.

## Ce qui a été supprimé, et non recouvert

`verifier-apres-fusion.ts` disparaît, avec deux de ses fonctions. Il n'était
qu'un cas particulier de la même question (« ce qui a bougé vient de `main` »),
et sa condition d'entrée était précisément le mur. Un correctif qui n'enlève
rien est un pansement ; celui-ci enlève.

## Ce qui a été refusé

**Laisser un rouge s'effacer tout seul.** Un rouge qui n'est pas remesuré garde
son rouge — même après une correction qui « devrait » l'avoir réglé. Sinon on
livrerait sur une supposition, ce qui est pire que cinquante minutes.

## Chiffres de ce lot

| | |
|---|---|
| niveau calculé | **2** — `npm run verifier:avant-fusion` |
| résultat | **395 suites sur 395 vertes**, types et lint à zéro erreur |
| le rattrapage, joué pour de vrai | **130 suites rouges ramenées à 1** en quatre étapes |
| ce que ce 1 était | une **vraie régression de ce lot** — un contrôle qui cherchait la liste des étapes dans son ancien fichier. C'est le rattrapage qui l'a trouvée, pas la relecture |
| batterie complète | **non jouée** |

## Ce qui reste vrai

La batterie entière reste obligatoire **avant la première poussée d'un lot**.
Ce qui change, c'est qu'un rouge corrigé ne la fait plus recommencer.

---

# Suite — 18 septembre 2026, 00 h 27 : « ça continue »

Quarante minutes après la correction ci-dessus, une session repartait pour
quarante-cinq minutes. Sa raison :

> *« `main` a apporté 30 commits, dont du code qui touche l'argent (devis,
> acomptes). La rencontre atteint le niveau 3 → batterie entière. »*

Elle appliquait la règle correctement. **La règle était fausse.**

## L'erreur, et elle était à moi

Le calcul de risque répond à **une** question : *quel danger ce lot
introduit-il ?* Je la posais aussi sur les fichiers que `main` apporte. Or ces
commits-là **ont déjà payé leur batterie** — la session qui a écrit les acomptes
a joué la mesure complète pour eux.

Résultat : à trois sessions, **chacune repayait la mesure des deux autres**.
C'est la même boucle, par une autre porte.

## Ce qui a été corrigé

La rencontre se partage en deux, et chaque moitié ne doit pas la même chose :

| Ce qui a bougé | Ce que ça coûte |
|---|---|
| **ton lot** — ce que cette session a écrit | gravité pleine : argent, sécurité → batterie, comme avant |
| **`main`**, une migration ou la configuration | **batterie** : ça change le sol sous toutes les mesures |
| **`main`**, du code d'argent ou de sécurité | les suites du fond (~5 min) — là où vivent les règles et l'isolation |
| **`main`**, le reste | les écrans concernés, et rien d'autre |

La troisième ligne est le cœur : la gravité de `main` **change ce qu'on rejoue,
pas si l'on rejoue tout**.

## Ce qui a été refusé

**Ignorer complètement ce que `main` apporte.** Ce serait plus rapide encore, et
faux : la rencontre entre ton lot et le code voisin n'a jamais été mesurée par
personne. Elle se rejoue — en minutes, pas en heure.

## Chiffres

| | |
|---|---|
| niveau | **2** — `npm run verifier:avant-fusion` |
| résultat | **395 suites sur 395 vertes** |
| le rattrapage, joué sur ce lot après une avancée de `main` | **Types + Lint**, une minute |
| batterie complète | **non jouée** |

---

# Suite — 18 septembre 2026 : le quatrième et dernier mur

Ta phrase : *« ça commence vraiment à me soûler ! »*. Tu avais raison, et
c'était le même défaut, d'un cran plus profond.

Le document de l'autre lot le disait au chiffre près : *« `main` avait avancé de
53 commits, dont le gabarit racine. Le garde-fou exige la batterie. »*
Quarante-cinq minutes, pour du code qu'une session voisine avait **déjà** prouvé.

## La règle, désormais

**La batterie entière prouve un LOT, jamais une rencontre.** Il ne reste qu'une
seule cause pour les cinquante minutes : **le risque de ton lot à lui**.

Ce que `main` apporte a déjà été prouvé par celui qui l'a écrit. Ce qui n'avait
jamais été mesuré, c'est **ton lot sur ce nouveau sol** — et ça se nomme :

| Ce que `main` apporte | Ce qu'on remesure |
|---|---|
| une migration | les suites du fond (la base a changé sous les règles) |
| la configuration | la **construction** — l'erreur qui condamne l'appli au mode lent |
| le gabarit, le style global | **tes écrans**, et la **connexion** (le défaut d'août, une minute) |
| du code d'argent | les suites du fond |

## Ce que j'ai corrigé de ma propre main

Le paragraphe écrit **quarante minutes plus tôt** gardait encore le gabarit
racine comme cause de batterie, et un contrôle l'affirmait. C'était la même
erreur. Le contrôle a été réécrit **avec sa raison**, pas effacé.

## Les quatre murs de la soirée — tous la même forme

| | La question posée | Celle qu'il fallait poser |
|---|---|---|
| 1 | ce fichier a-t-il une date neuve ? | son **contenu** a-t-il changé ? |
| 2 | le lot a-t-il bougé ? | que peut **casser** ce qui a bougé ? |
| 3 | ce fichier est-il grave ? | **qui** a déjà prouvé sa gravité ? |
| 4 | ce fichier est-il un plancher ? | que reste-t-il à mesurer **sous** le lot ? |

## Ce qui reste, et qui ne peut pas se faire d'ici

Les **dix-neuf suites d'outillage rouges sur ton PC Windows** coûtent encore
~30 min de comparaison par lot. Elles ne mesurent rien chez toi — elles
cherchent `bash`, `ps`, `gh`. Une suite qui ne peut pas mesurer doit **refuser
de conclure**, pas rougir : un « non applicable » n'entre pas dans les rouges et
ne déclenche aucune comparaison.

**Ça se corrige sur TA machine, pas ici** — ce poste est sous Linux, je ne verrais
pas ce qu'elles rendent chez toi. C'est écrit dans `TODO.md` avec la marche à
suivre. Lance `claude` dans ton espace Windows et demande-lui ce point-là.

## Chiffres

| | |
|---|---|
| niveau | **2** — `npm run verifier:avant-fusion` |
| résultat | **vert** |
| batterie complète | **non jouée** |
