<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rien n'est acté valide sans avoir été éprouvé

**Règle posée par le patron, et qui prime sur l'envie d'avancer :** avant de dire
qu'une chose fonctionne, l'avoir essayée soi-même — pas relue, pas compilée :
essayée.

Trois fois de suite, un banc d'essai a été livré « prêt » et c'est le patron qui
a trouvé le défaut : un script absent, une application pas encore prête, un port
fermé. À chaque fois le code était juste ; c'est le parcours qui ne l'était pas.

**Et cela veut dire : essayer soi-même AVANT de lui demander d'essayer.** Vingt
échanges ont été consommés à lui faire ouvrir une application qui refusait sa
connexion — « Invalid Server Actions request. ». Chaque fois les voyants étaient
verts, parce qu'aucun contrôle ne parcourait ce que lui parcourait. Il a fait
vingt fois le test à ma place.

La commande existe, et se joue **avant chaque livraison** :

```bash
npm run verifier:avant-livraison
```

Elle enchaîne types, lint, mémoire, suites base, suites navigateur, et surtout
une **connexion réelle dans un vrai navigateur derrière une origine étrangère**
— le seul contrôle qui aurait vu le défaut. Tant qu'elle n'est pas au vert, on
ne demande rien au patron.

Ce que cela exige concrètement, à chaque lot :

- **Parcourir en entier ce qu'on transmet.** Un mode d'emploi, une commande, une
  adresse : du premier geste au dernier, dans les conditions du patron. Compiler
  n'est pas fonctionner, et « ça devrait marcher » n'est pas un test.
- **Un contrôle doit savoir échouer.** Le confronter à l'état dégradé qu'il
  prétend détecter. Un contrôle qui n'a jamais échoué ne prouve rien. **Et son
  message doit désigner le bon coupable** : une erreur qui envoie chercher au
  mauvais endroit coûte plus cher que pas d'erreur du tout.
- **Devant un défaut qui ne se reproduit pas ici : commencer par se demander si
  SA PAGE A SURVÉCU À SON SERVEUR.** Règle posée par le patron le 12 août 2026 —
  *« retiens ce problème, et la prochaine fois qu'on a un souci, commence par
  regarder si ce n'est pas ça »*. Son banc redémarre plusieurs fois par soirée ;
  son onglet reste ouvert des heures. Trois défauts en deux jours, trois
  symptômes sans rapport apparent, une seule racine — et deux jours perdus à les
  traiter séparément. **Lui demander d'abord :** depuis combien de temps la page
  était-elle ouverte, et est-ce qu'un rechargement répare ? Si oui, c'est ça. Le
  détail et la marche à suivre sont en tête de `HANDOVER.md`.
- **Reproduire la SÉQUENCE du patron, pas seulement son geste.** Nos suites
  ouvrent une page et agissent dans la seconde ; lui ouvre, regarde, réfléchit,
  puis agit. C'est ce temps-là qui fabriquait la panne, et c'est en le rejouant
  qu'elle est enfin apparue (`scripts/eprouver-page-vieillie.mts`). Un parcours
  éprouvé « vite » n'est pas le sien.
- **Reproduire le message du serveur, jamais l'idée qu'on s'en fait.** Trois
  correctifs de suite sont passés au vert en réparant une panne *imaginée* :
  l'écart d'origine avait été supposé dans un sens, il allait dans l'autre. Les
  contrôles savaient échouer — sur le mauvais défaut. **Avant de corriger, aller
  chercher la ligne exacte que le serveur écrit.** Une demi-journée de plus a été
  perdue faute de l'avoir lue.
- **Et si le message n'existe pas, le faire exister avant de chercher.** Le
  11 août 2026, le patron signale « Impossible d'enregistrer la note pour
  l'instant. Réessayez. » — et personne ne peut savoir pourquoi : les quatre
  refus possibles portaient chacun leur phrase, et l'écran les jetait tous dans
  un `catch {}`. Rien n'était journalisé. **Devant un défaut muet, la première
  livraison n'est pas un correctif : c'est de rendre le défaut bavard.** Deviner
  à sa place, c'est réparer une panne imaginée — le piège juste au-dessus.
  Corollaire propre à ce cadre : **le message d'une exception levée par une
  action serveur n'arrive JAMAIS jusqu'à lui** (Next.js le remplace en
  production par un identifiant opaque, et son banc sert une version bâtie). Un
  refus attendu se rend en valeur de retour ; une panne imprévue se journalise
  avant de lever. Voir `HANDOVER.md`, piège 0 ter.
- **Ne jamais transmettre une commande non vérifiée sans le dire.** Si elle ne
  peut pas l'être ici, l'écrire noir sur blanc plutôt que de la présenter comme
  sûre.
- **Ne pas annoncer une panne corrigée quand seul le silence l'a été.** Ce qui
  n'a pas pu être reproduit ici s'écrit comme non reproduit — dans le journal
  des changements, dans `TODO.md`, et au patron. Une réparation supposée
  présentée comme acquise lui coûte l'essai, puis l'aller-retour.
- **Ce qui ne peut pas être éprouvé ici doit l'être ailleurs.** Cet environnement
  n'a ni démon Docker, ni GitHub CLI, et son mandataire réseau refuse `github.io`,
  `api.github.com` et la documentation GitHub. Ne pas contourner : déplacer la
  vérification vers une machine — c'est ce que font `pages.yml` pour le site
  publié et `banc-essai.yml` pour l'espace de travail.
- **Mais la base, elle, tourne ici** — corrigé le 2026-08-05 contre ce que le
  dépôt affirmait. `source scripts/monter-base-locale.sh` monte PostgreSQL,
  Redis, les rôles et les migrations en une commande, sans Docker. Il n'y a donc
  plus d'excuse à livrer sans avoir joué `npm test`.

Le détail des commandes est dans `CLAUDE.md` §5.

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
