# Niveau de test calculé sur le risque — le dossier

**Ouvert le 14 septembre 2026.** Objet : remplacer la règle « tout changement
dans `src/` = batterie complète » par un niveau **calculé** sur l'impact réel
du lot.

**État : rien n'est codé.** Ni `.claude/rules/testing.md`, ni
`scripts/_niveau-de-risque.mjs`, ni `scripts/garde-fusion-main.mjs` n'ont
bougé. Ce dossier porte l'analyse et attend l'arbitrage.

---

## Ce que chaque pièce porte

| | |
|---|---|
| [`1-lecture-du-brief.md`](1-lecture-du-brief.md) | la lecture de la proposition reçue : ce qui est juste, ce qui est refusé, et pourquoi |
| [`2-revue-d-architecture.md`](2-revue-d-architecture.md) | la revue des trois réserves, les angles morts, et **la règle finale proposée** |
| [`3-mesures.md`](3-mesures.md) | tous les chiffres cités, et comment les rejouer |
| `mesurer-rayon-impact.mjs` | le calcul qui les produit — `node docs/niveau-de-risque/mesurer-rayon-impact.mjs` |

## La règle proposée, en une ligne

```
niveau = MAX( plancher , rayon , gravité )
```

Jamais un minimum, jamais une moyenne. Le détail est au §4 de la revue.

## Ce qui reste à trancher, et par qui

| | Qui |
|---|---|
| l'invariant `CLAUDE.md` §0.3 — *« jamais rien de moins qu'elle quand `src/` bouge »* | **le patron** : c'est sa règle |
| le seuil de rayon entre niveau 2 et niveau 3 | à mesurer, pas à décider d'avance |
| la liste de gravité (facturation, auth, isolation) | le patron — c'est lui qui sait ce qui coûte cher |

## Une erreur corrigée dans ce dossier

La première version de `1-lecture-du-brief.md` donnait comme « cas de
référence mesuré » un fichier **chantier**, alors que le lot en cours porte
sur les **clients**. La mesure était réelle, mais elle portait sur le mauvais
fichier — une liste tronquée avait été prise pour une absence. Corrigé, et
raconté au §4 de ce même document.
