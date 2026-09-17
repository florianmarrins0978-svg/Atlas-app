# Éprouver — les trois niveaux

Chargé dans **toutes** les sessions Atlas (importé par `CLAUDE.md`).

---

## Compiler n'est pas fonctionner

`tsc` vert ne dit rien du produit. Ce dépôt a livré trois fois du code qui
compilait et que le patron ne pouvait pas utiliser. **Rien n'est terminé tant
que le parcours qu'il fait, lui, n'a pas été joué.**

## Le niveau se CALCULE sur le risque — il ne se déclare pas

Rejouer soixante suites pour une virgule coûte cinquante minutes et n'apprend
rien ; n'en jouer aucune sur une migration coûte une soirée. Ce qui décide,
c'est **l'impact réel du lot** — et il se calcule sur le diff.

```
niveau = MAX( plancher , rayon , gravité )
```

Jamais un minimum, jamais une moyenne. Trois façons d'être dangereux ; il
suffit d'une.

| Composante | Ce qui la déclenche | Niveau |
|---|---|---|
| **Plancher** | `drizzle/`, `middleware.ts`, `layout.tsx` racine, `globals.css`, `src/server/db/`, `env`/`logger`/`request-context`, `package.json`, `next.config`, `tsconfig` | **3** |
| **Gravité — sécurité** | authentification, sessions, RLS, `withEntreprise`, isolation, rôles, permissions | **3** |
| **Gravité — argent** | facturation, TVA, devis, règlements, paiements, acomptes, prix, remises, avoirs | **3** |
| **Rayon** | le fichier atteint **10 points d'entrée ou plus** | **3** |
| **Rayon** | 1 à 9 points d'entrée | **2** |
| **Indéterminable** | route d'API (`fetch` n'est pas un import), fichier non `.ts`/`.tsx`, fichier effacé ou renommé, écran qu'aucune suite n'ouvre | **3** |
| **Outillage** | `scripts/`, `.claude/`, `.devcontainer/`, `.github/`, `maquettes/` | **2** |
| **Ce qui ne s'exécute pas** | `docs/`, `appli/`, un `.md` | **1** |

**Un point d'entrée n'est pas une catégorie à énumérer : c'est un fichier que
personne n'importe** — le routeur Next, un cron ou un script l'appelle depuis
l'extérieur du code. Une liste d'« entrypoints » aurait vieilli ; cette
définition accueille toute seule la route ou le cron ajouté demain.

**Le chemin est un INDICE, jamais la décision.** La règle d'avant lisait
`^src/` et rendait 3 : elle se trompait dans les deux sens — 339 fichiers sur
697 n'atteignent qu'un seul point d'entrée, et `src/lib/civilite.ts` en atteint
64 sans figurer sur aucune liste.

**LES DEUX LISTES NE JOUENT PAS LE MÊME RÔLE, et c'est tout le principe :**

| | |
|---|---|
| une liste qui **ABAISSE** le niveau | **refusée** — le jour où elle oublie un fichier, du danger part et rien ne le dit |
| une liste qui **REMONTE** le niveau (plancher, gravité) | acceptée — le jour où elle se trompe, on joue une batterie de trop |

Ce qui abaisse n'est donc jamais une liste : c'est le **rayon**, calculé sur le
graphe d'imports. **Une session ne peut pas se l'accorder.**

**Le niveau n'est pas déclaratif** : `scripts/garde-fusion-main.mjs` le calcule
sur le diff et refuse la fusion si le contrôle correspondant n'a pas été joué
au vert sur CET état de l'arbre. Il annonce alors, de lui-même :

```
Risque : moyen
Niveau requis : 2
Raison : rayon de 1 point(s) d'entrée
Contrôles exigés : npm run verifier:avant-fusion, dont les suites …
```

Pour voir le niveau d'un lot sans pousser : `npm run niveau`.

## Niveau 1 — ce qui ne s'exécute pas

`docs/`, `appli/`, un `.md` : relire le rendu suffit.

**Pendant qu'on écrit**, quel que soit le niveau : les suites du domaine
touché, à la main — `npx tsx scripts/test-<la-suite>.ts`. Un contrôle joué en
boucle sur ce qu'on vient d'écrire vaut mieux qu'une batterie jouée une fois à
la fin.

## Niveau 2 — un lot à impact BORNÉ

```bash
npm run verifier:avant-fusion
```

Types, style, mémoire du dépôt, suites du dépôt — **et les suites navigateur
des écrans que le lot atteint, dérivées de l'adresse qu'elles ouvrent.**

Cette dernière étape n'est pas un supplément : types et lint ne parcourent
rien, et c'est exactement ce qui a laissé passer « Invalid Server Actions
request. » — vingt allers-retours, tous les voyants au vert. Un écran touché
s'ouvre dans un vrai navigateur, et **un écran qu'aucune suite n'ouvre fait
passer le lot en niveau 3** : il n'y aurait rien à jouer qui le regarde.

Ce contrôle **refuse** de rendre un vert sur un lot de niveau 3.

## Niveau 3 — transversal ou dangereux

```bash
npm run verifier:avant-livraison
```

La batterie entière, inchangée. Obligatoire dès que le plancher, la gravité ou
un rayon de dix points d'entrée est atteint. **Le prévenir avant de la
lancer** — ses sessions partagent son dossier (`CLAUDE.md` §5).

## Une tâche = un lot isolé, mesuré sur SON diff

**Sa règle du 17 septembre 2026**, après douze commits de quatre sujets
retenus par un seul rouge : chaque tâche se prépare à part depuis
`origin/main` propre, son niveau se calcule sur son seul diff, ses contrôles se
jouent dans son dossier, et elle se pousse de là (`git -C <dossier> push origin
HEAD:main`). Le garde-fou mesure **le dossier que la commande vise**
(`dossierDeLaCommande`) — un lot de niveau 2 n'attend jamais un lot de
niveau 3 voisin. Le détail est dans `CLAUDE.md` §6.

## `main` a avancé sous un lot éprouvé : on rejoue la rencontre, pas la batterie

**Sa règle du 17 septembre 2026 : *« Rejoue juste ce qui a bougé ! »*.**
`npx tsx scripts/verifier-ce-qui-a-bouge.ts`, dans le dossier du lot une fois reposé sur
`main`. Il vaut la batterie si **le lot est identique à la ligne près** à ce
qu'elle a mesuré, si son verdict ne portait aucun rouge nouveau, et si la
rencontre rejouée est verte : suites base, écrans du lot, écrans touchés par
`main`, suites apportées par `main`. Le verdict déposé garde le niveau du
verdict d'avant ; le garde-fou le relit comme n'importe quel autre. Un lot qui
a changé, un verdict d'avant ce mécanisme, un rouge nouveau : batterie.

## Le garde-fou compare des CONTENUS, jamais des dates — 17 septembre 2026

**Sa colère :** *« les sessions rejouent des batteries en boucle juste parce
qu'une a touché un fichier »*. Le garde-fou de `main` mesurait la date de la
dernière écriture : une fusion réécrit ce qu'elle apporte, donc tout lot vert
perdait son verdict dès que `main` avançait — et le refus n'annonçait que la
batterie entière.

| Ce qui a bougé depuis le verdict | Ce qu'il faut jouer |
|---|---|
| rien, au contenu près | **rien** — la fusion s'ouvre, même après une fusion |
| un fichier **du lot** | le contrôle de son niveau |
| **seulement** ce que `main` a apporté | `npx tsx scripts/verifier-ce-qui-a-bouge.ts` |

Le garde-fou nomme lui-même le complément dans son refus : il n'y a plus à s'en
souvenir au bout de trois heures. `ARCHITECTURE.md` §380.

## Un rouge CORRIGÉ se rejoue seul — 17 septembre 2026, 23 h

**Sa colère :** *« ça recommence et c'est ça à chaque fois ! »*. Une étape hors
suites — Types, Lint, Mémoire du dépôt, Construction — n'avait aucun moyen de
redevenir verte sans les cinquante minutes, et corriger un rouge faisait
refuser le complément d'après-fusion.

```bash
npx tsx scripts/verifier-ce-qui-a-bouge.ts
```

| | |
|---|---|
| ce qui a bougé | par le CONTENU : l'empreinte du verdict, et git pour ce qu'elle n'indexe pas (`.md`, `docs/`, `.claude/`) |
| ce qu'on rejoue | ce qui était rouge, plus ce que ce qui a bougé peut casser (la rencontre) |
| ce qu'on ne rejoue pas | garde son rouge — ne pas savoir n'est jamais vert |
| ce qui renvoie à la batterie | ce qui a bougé atteint le niveau 3 |

`ARCHITECTURE.md` §381.

## Un rouge venu d'AILLEURS ne ferme pas la porte — une régression NOUVELLE, si

**Sa règle du 17 septembre 2026**, après une journée entière perdue : *« Je ne
veux plus qu'un lot soit bloqué par un rouge provenant d'une autre session, ni
qu'une batterie complète soit relancée sur main uniquement pour établir un état
de référence. Le garde doit répondre à une seule question : ce lot
introduit-il une NOUVELLE régression ? »*

**Ce qui a été supprimé, et pourquoi c'était contre-productif.** La version du
16 septembre comparait le verdict d'un lot à un **état global de `main`**,
relevé par une batterie entière jouée sur un arbre propre. Tant que cette mesure
n'existait pas sur la machine, le moindre rouge fermait la porte — même dans une
zone du produit que le lot ne touche pas —, et le seul remède coûtait trente à
cinquante minutes, à repayer à chaque `main` qui avance. Les sessions se
bloquaient entre elles.

**Ce qui le remplace : la comparaison CIBLÉE des seuls rouges.**

| | |
|---|---|
| le niveau | se calcule sur le diff du lot, et sur lui seul — un rouge d'ailleurs ne le fait JAMAIS monter |
| les contrôles | ceux de son niveau, rien de plus |
| tout vert | la fusion est ouverte |
| un ou plusieurs rouges | **chaque suite rouge**, elle seule, est rejouée sur une copie propre du commit de `main` d'où le lot part (`npx tsx scripts/verifier-rouge-prealable.ts`) |

Trois réponses, et trois seulement :

| sur la base de `main` | ce que ça vaut |
|---|---|
| rouge de la même façon | **préexistant** — il ne bloque pas ce lot |
| vert | **régression nouvelle** — la fusion est refusée |
| indéterminé, ou pas mesuré | **bloqué, sur ce cas-là seulement** — ne pas savoir n'est jamais « c'était déjà rouge » |

**Le commit git suffit** : plus aucun état global, plus aucune batterie sur
`main`. La copie propre est un `git worktree` posé dans le `.git` commun, ses
dépendances liées fichier à fichier, et **elle prend son propre atelier** — sans
quoi les deux dossiers mesureraient la même base et se videraient l'un l'autre.

**Ce qui ferme toujours la porte** : une étape hors suites (types, lint,
construction, connexion) — celles-là n'ont pas de rouge connu ; un bilan dont le
compte ne tombe pas juste ; un verdict sans la liste de ses suites ; une réponse
mesurée sur une AUTRE base de `main`, qui ne dit rien de celle-ci.

**La batterie entière reste réservée aux lots de niveau 3 pour LEUR propre
risque** — jamais parce que `main` porte un rouge par ailleurs.

Les cinq cas qu'il a demandés sont éprouvés dans `scripts/test-garde-fusion-main.ts`
(A à E), et la décision elle-même vit dans `scripts/_rouge-prealable.mjs`, sans
git ni navigateur.

## `main` qui avance ne refait pas la batterie : on mesure la RENCONTRE

**Sa règle du 17 septembre 2026 :** *« Chaque lot doit prouver SON propre
travail. Le fait que main change parce qu'une autre session a fusionné ne doit
jamais, à lui seul, provoquer une nouvelle batterie complète. »*

| ce qui arrive | ce qu'on joue |
|---|---|
| le lot a passé les contrôles de son niveau | ils **restent valables** tant que le lot ne change pas |
| `main` avance, sans rapport avec le lot | **rien** — `npx tsx scripts/verifier-ce-qui-a-bouge.ts` le constate et repose le verdict |
| `main` touche une dépendance que le lot emploie, ou un appelant du lot | **seulement** les suites de ces fichiers-là |
| un conflit git | on le résout, et l'on rejoue ce que la résolution touche — c'est la même rencontre |
| le lot lui-même a changé | son niveau décide à nouveau, depuis zéro |

**La rencontre se MESURE** (`_apres-fusion.mjs`, `rencontreReelle`) : le graphe
d'imports dit, dans les deux sens, ce que le lot emploie et ce qui l'emploie.
Ce qui n'est dans aucun des deux ne se rejoue pas. Ce que le graphe ne sait pas
lire — une migration, un réglage de construction, un fichier d'outillage — entre
toujours dans la rencontre : c'est le côté sûr.

**La batterie entière reste réservée** à un lot de niveau 3 pour SON propre
risque, ou à une rencontre qui atteint elle-même le niveau 3 — une migration
arrivée de `main` sous un lot qui touche la base. Jamais parce que `main` a
bougé, qu'une autre session a fusionné, qu'elle avait un rouge, ou que deux lots
travaillent dans le même grand domaine.

## Une régression découverte donne TOUJOURS un test

Dans cet ordre, sans raccourci :

1. **reproduire** — dans les conditions du patron, pas dans les nôtres ;
2. **un test ROUGE** qui reproduit exactement le cas ;
3. **la correction**, minimale et à la racine ;
4. **le test VERT** ;
5. **le test RESTE**, pour toujours, dans la suite.

Un correctif sans test rouge d'abord n'est pas un correctif : c'est une
supposition qui a l'air de marcher.

**Et un contrôle doit savoir échouer.** Le confronter à l'état dégradé qu'il
prétend détecter, et le voir rougir. Un contrôle jamais vu rouge ne prouve rien
— celui de la migration 0087 est passé au vert sur une correction qui ne
réparait rien, faute de porter la RLS (`ARCHITECTURE.md` §358).

## Avant une fusion : les parcours concernés

Pas « les tests passent » — **les écrans touchés, regardés**. Quatre défauts
réels de ce dépôt sont sortis d'une capture, aucun d'un test vert.

## Hors périmètre : on ne touche pas

Aucun refactoring, aucun nettoyage, aucune amélioration annexe dans un lot qui
n'en demandait pas. Un lot qui fait deux choses ne peut plus être défait pour
une seule.
