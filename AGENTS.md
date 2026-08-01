<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Le document `docs/QUESTIONS.md`

Ce dépôt tient un journal des questions posées par le patron et de leurs
réponses, en langage courant. Il existe parce que ces réponses se perdaient dans
le fil des conversations : une décision expliquée une fois puis oubliée se
repose trois mois plus tard, et se retranche parfois dans l'autre sens.

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
