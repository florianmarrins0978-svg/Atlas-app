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
| `07-correction-complete.md` | **l'état final** | ce que la chaîne fait désormais, ce qui a été refusé, et la seule question qui lui revient |
| `08-validation-reelle.md` | validation | pourquoi la chaîne n'est PAS prouvée en conditions réelles, et ce qui protège d'une faute de Whisper |
| `09-mise-sur-main.md` | migrations | la preuve que deux migrations peuvent porter le même numéro sans danger |

**Le dossier 07 remplace les six premiers.** Ils restent comme le chemin
parcouru — un instantané ne se corrige pas, `CLAUDE.md` §2 bis — mais ce qui
décrit l'application d'aujourd'hui, c'est le 07 et le dépôt.

## ⚠️ Le titre du dossier 09 est FAUX, et il a coûté un aller-retour

**Il s'intitule « Mise sur `main` de la correction ». Elle n'était pas faite.**
Le corps du dossier décrit la fusion `origin/main` **vers la branche de
travail** — l'inverse du sens que son titre annonce.

Le patron a lu ce titre, est allé dans son Codespace sur `main`, et a tapé
`npm run verifier:chaine-dictee`. npm lui a répondu **« Missing script »**, ce
qui était exact : les commits vivaient sur `origin/claude/audit-dictee-devis-ryqfy6`
et nulle part ailleurs. Il a dû faire lui-même le diagnostic que ce titre aurait
dû lui épargner.

**Ce que ça apprend, et qui vaut pour tout dossier à venir :** le dossier 08
avait déjà été repris pour avoir appelé « fusion » deux opérations de sens
opposé. La correction a été écrite dans le corps du 09 — et son TITRE a
reproduit la faute. **Un titre est lu par quelqu'un qui n'ouvrira peut-être pas
le document**, et il engage donc autant que le contenu.

La règle qui en découle : **un titre de dossier ne décrit jamais un état du
dépôt** (« mis sur `main` », « livré », « déployé »). Il nomme le SUJET traité.
Ce qui est fait ou non se lit dans le corps, où il peut être mesuré.

Le dossier lui-même n'est pas corrigé — un instantané ne se réécrit pas
(`CLAUDE.md` §2 bis). C'est ce paragraphe-ci qui porte le démenti.
