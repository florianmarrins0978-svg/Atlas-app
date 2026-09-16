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

## Un rouge déjà rouge sur `main` ne ferme pas la porte — un rouge NOUVEAU, si

**Sa règle du 16 septembre 2026 :** *« état de référence connu + nouveau lot →
aucun nouveau rouge autorisé. Un test qui était vert avant et devient rouge
doit bloquer. Un nouveau test rouge doit bloquer. Un rouge préexistant
identique ne doit pas empêcher éternellement toutes les futures fusions. »*

Sur son PC, seize suites d'outillage rougissent depuis toujours (`bash`,
`ps -o`, `gh`, `npx.cmd`). Le garde-fou ne voyait qu'un verdict ROUGE et
refusait tout lot d'argent, pour toujours — et il a refusé une liste
d'exceptions pour ces seize : **une liste qui abaisse le niveau vieillit**.

Ce qui la remplace est une MESURE :

| | |
|---|---|
| la batterie **nomme** ses suites rouges dans son verdict | `rouges`, lues dans ce que les moteurs écrivent (`_bilan-suites.mjs`) |
| jouée sur un arbre propre **qui est `origin/main`**, elle enregistre l'**état de référence** | dans le `.git` commun, propre à la machine (`_reference-batterie.mjs`) |
| le garde-fou compare | `rougesToleres` : chaque rouge du lot doit déjà être rouge dans la référence, **et la référence doit être dans l'histoire du lot** |

**Ce qui ferme toujours la porte** : une suite verte sur `main` devenue rouge,
une suite nouvelle et rouge, une étape hors suites tombée (types, lint,
construction, connexion), un bilan dont le compte ne tombe pas juste, un verdict
sans la liste de ses suites, une référence absente. Et ce qui est toléré se
**dit** à la poussée — un rouge qui passe en silence redeviendrait invisible.

Premier tour d'une machine, ou `main` d'avant le 16 septembre : la référence
s'amorce depuis le journal d'une batterie jouée sur `main` propre, avec le même
lecteur — `npx tsx scripts/reference-depuis-journal.ts <journal> --commit <sha>`.
Ensuite, toute batterie jouée sur `main` propre la remet à jour d'elle-même.

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
