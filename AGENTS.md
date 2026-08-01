<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# La mémoire du dépôt

**Le dépôt est la source de vérité, pas la conversation.** Six fichiers portent
tout ce qu'il faut pour reprendre le travail à froid, et se tiennent à jour
**sans qu'on le demande** : `CLAUDE.md`, `PROJECT_STATE.md`, `ARCHITECTURE.md`,
`HANDOVER.md`, `CHANGELOG.md`, `TODO.md`.

Le protocole complet — quoi lire en arrivant, quoi écrire après chaque lot — est
dans **`CLAUDE.md`**, §1 et §2. Il s'applique à chaque conversation, y compris
celle-ci.

Règle qui prime sur toutes les autres : **si une information apparue dans la
conversation n'existe nulle part dans le dépôt, l'écrire avant de poursuivre.**
Le critère n'est pas « est-ce intéressant » mais : *une nouvelle conversation
prendrait-elle une mauvaise décision faute de le savoir ?*

# Les deux documents tenus pour le patron

Ce dépôt tient deux documents en langage courant, alimentés au fil des
conversations. Ils existent parce que ce qui s'y trouve se perdait autrement :
une décision expliquée une fois puis oubliée se repose trois mois plus tard, et
un point à traiter mentionné en passant ne réapparaît jamais.

- **`docs/QUESTIONS.md`** — les questions posées et leurs réponses.
- **`docs/A-FAIRE.md`** — ce qui doit être réglé, et par qui.

Après toute modification de l'un d'eux, régénérer sa page consultable :
`node scripts/md-en-page.mjs docs/QUESTIONS.md docs/questions.html` et
`node scripts/md-en-page.mjs docs/A-FAIRE.md`. Vérifier ensuite que chaque lien
du sommaire vise une ancre existante — un sommaire cassé décourage la
consultation plus sûrement qu'un document mal écrit.

## `docs/A-FAIRE.md` — ce qui reste à régler

Dès qu'apparaît, dans la conversation, quelque chose d'important **qui reste à
faire** — un point bloquant, un risque qu'on ne peut pas laisser courir, une
décision sans laquelle la suite est impossible — le signaler puis demander :
**« Je l'ajoute au document à faire ? »** Attendre la réponse.

Ne pas y verser les tâches de développement ordinaires : ce document sert ce qui
ne se résoudra pas tout seul en codant. Chaque point indique **qui peut le
faire** — un point sans propriétaire est un point qui dort.

Un point traité se **barre** plutôt qu'il ne se supprime, avec sa date : savoir
qu'il a été réglé évite de le rouvrir.

## `docs/QUESTIONS.md` — les questions et leurs réponses

**Trois règles, à appliquer sans qu'on ait à les rappeler.**

### 1. Consulter avant de répondre

Devant une question de fond — un coût, une règle, un arbitrage, un « pourquoi » —
lire `docs/QUESTIONS.md` **avant** de composer la réponse.

Si elle y figure déjà : le dire, puis **citer le passage concerné** plutôt que
de reformuler. Reformuler de mémoire, c'est risquer de répondre différemment de
la fois précédente — et c'est précisément ce que ce document empêche.

Si la réponse a changé depuis, le signaler explicitement et mettre le document à
jour : une réponse périmée est pire qu'aucune, parce qu'on s'y fie encore.

### 2. Proposer d'ajouter, jamais ajouter d'office

Après avoir répondu à une question qui dépasse le détail technique du moment,
demander : **« Je l'ajoute au document ? »** Attendre la réponse. Rien n'y entre
sans accord explicite.

Ne pas le proposer pour une question de circonstance (« où en est la CI ? »,
« c'est fusionné ? ») : le document perdrait sa valeur à force d'y accumuler du
bruit.

### 3. Écrire pour être relu dans six mois

Langage courant, pas de jargon. Dire ce que ça coûte, qui paie, ce qui a été
écarté et pourquoi. Un tableau vaut mieux qu'un paragraphe quand il s'agit de
chiffres.
