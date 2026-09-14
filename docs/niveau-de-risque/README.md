# Niveau de test calculé sur le risque — le dossier

**Ouvert le 14 septembre 2026.** Objet : remplacer la règle « tout changement
dans `src/` = batterie complète » par un niveau **calculé** sur l'impact réel
du lot.

**État : validé et CODÉ le 14 septembre 2026.** La règle vit dans
`scripts/_niveau-de-risque.mjs`, le garde-fou l'impose, `npm run niveau` la
dit. Ce dossier porte l'analyse qui y a mené ; la règle active, elle, est dans
`.claude/rules/testing.md` et `ARCHITECTURE.md` §365.

---

## Ce que chaque pièce porte

| | |
|---|---|
| [`POUR-CHATGPT.md`](POUR-CHATGPT.md) | **le dossier entier en un seul document, autonome** — c'est celui qui se transmet |
| [`1-lecture-du-brief.md`](1-lecture-du-brief.md) | la lecture de la proposition reçue : ce qui est juste, ce qui est refusé, et pourquoi |
| [`2-revue-d-architecture.md`](2-revue-d-architecture.md) | la revue des trois réserves, les angles morts, et **la règle finale proposée** |
| [`3-mesures.md`](3-mesures.md) | tous les chiffres cités, et comment les rejouer |
| `mesurer-rayon-impact.mjs` | le calcul qui les produit — `node -e "import('./scripts/_rayon-impact.mjs')"` |

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
