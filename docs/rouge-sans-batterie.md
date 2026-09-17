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
