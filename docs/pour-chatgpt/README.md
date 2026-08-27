# Les dossiers à transmettre à ChatGPT

**Consigne du patron, 26 août 2026 :** *« Je vais tout montrer à ChatGPT, donc
fais-moi des dossiers que je peux lui copier-coller à chaque fois. »*

Un dossier par étape du lot, numéroté. Il les ouvre, il sélectionne tout, il
colle. C'est tout ce qu'il a à faire.

## Ce qu'un dossier doit être

- **Autonome.** ChatGPT n'a pas accès au dépôt. Chaque dossier porte le contexte,
  les extraits de code qui comptent (verbatim, pas résumés), les mesures
  réellement faites, et ce qu'on en conclut. Un dossier qui suppose la lecture du
  précédent oblige le patron à recoller trois documents.
- **Un seul bloc.** Pas de pièce jointe, pas de lien à suivre : du texte.
- **Il se termine par des QUESTIONS**, numérotées, dont au moins une demande à
  ChatGPT de contredire ce qu'on avance. On lui transmet ces documents pour un
  second avis, pas pour une approbation.
- **Il dit ce qu'on n'a pas pu vérifier**, et pourquoi. Une mesure absente
  présentée comme acquise fait travailler l'autre sur du vide.

## Ce qu'un dossier n'est pas

Ce n'est **pas** la mémoire du dépôt. Ces fichiers sont des instantanés : ils
décrivent l'état à une date, et ils ne se tiennent pas à jour. Ce qui fait foi
reste `CLAUDE.md`, `ARCHITECTURE.md`, `TODO.md` et les documents d'audit.

**Un dossier ne se corrige donc pas après coup** — on en écrit un nouveau. Cela
évite le piège du §3 de `CLAUDE.md` : deux écritures de la même règle qui
divergent. Si un verdict d'un ancien dossier se révèle faux, le suivant le dit
noir sur blanc, comme le demande `CLAUDE.md` §2 bis.

## Les dossiers

| # | Étape | Ce qu'il porte |
|---|---|---|
| `01-diagnostic.md` | phase de lecture | où chaque information devient fausse, du micro à l'écran |
| `02-cartographie-et-tests.md` | avant correction | les consommateurs, les dépendances cachées, neuf contrôles rouges, les migrations |
| `03-lot-A-p0.md` | lot A | le garde-fou qui ferme la corruption de l'apprentissage, et pourquoi il laisse passer sa règle du 7 août |
| `04-lot-B-modele-structure.md` | lot B | les colonnes de la prestation, la table de liaison, et la cardinalité inspectée plutôt que choisie |
| `05-lot-C-consommateurs.md` | lot C | le contrat structure / libellé / contradiction, et les trois décisions métier que je refuse de prendre seul |
| `06-lot-C-suite-r23-et-unites.md` | lot C (suite) | le doublon du rejeu, les unités de comptage, et l'inventaire des natures réellement présentes |
