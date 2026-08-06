# Essayer Atlas en entier, depuis votre téléphone

Ce document explique comment ouvrir **l'application complète** — chantiers,
planning, envoi du devis au client, réponse du client, facture, TVA — et s'en
servir vraiment, avec de vraies données saisies par vous.

Pas d'installation, pas de carte bancaire, pas de nouveau compte : seulement
votre compte GitHub, que vous avez déjà.

---

## Sommaire

1. [Ce que vous allez ouvrir, et ce que ce n'est pas](#ce-que-vous-allez-ouvrir-et-ce-que-ce-nest-pas)
2. [En cinq gestes](#en-cinq-gestes)
3. [Ce que vous pouvez essayer, du début à la fin](#ce-que-vous-pouvez-essayer-du-début-à-la-fin)
4. [Ce qui ne marchera pas, et pourquoi](#ce-qui-ne-marchera-pas-et-pourquoi)
5. [Brancher une vraie IA sur vos essais](#brancher-une-vraie-ia-sur-vos-essais)
6. [Repartir de zéro](#repartir-de-zéro)
7. [Fermer proprement](#fermer-proprement)
8. [Si quelque chose ne va pas](#si-quelque-chose-ne-va-pas)

---

## Ce que vous allez ouvrir, et ce que ce n'est pas

| | Le site public | Ce que ce document ouvre |
|---|---|---|
| Adresse | `…github.io/Atlas-app/` | Une adresse temporaire, à vous seul |
| Contenu | Cinq maquettes figées | **L'application entière** |
| Données | Aucune | Les vôtres, enregistrées |
| Durée de vie | Permanent | Tant que vous le gardez ouvert |

Ce n'est **pas** une mise en production. C'est un banc d'essai : personne
d'autre que vous n'y accède, et tout s'efface quand vous le supprimez. Les
véritables décisions d'hébergement restent entières
(voir [`A-FAIRE.md`](A-FAIRE.md) §3).

---

## En cinq gestes

### 1. Ouvrir l'espace de travail

Sur `github.com/florianmarrins0978-svg/Atlas-app` : bouton vert **« Code »**,
onglet **« Codespaces »**, puis **« Create codespace on main »**.

Un ordinateur se monte pour vous dans le navigateur. **Comptez cinq à dix
minutes la première fois** : il installe la base de données, applique le schéma
et insère les données de démonstration. Les fois suivantes, quelques secondes.

Vous saurez que c'est prêt quand le terminal affiche **« Atlas est prêt »**.

> **Un espace de travail est figé à sa création.** Il garde la version du dépôt
> qu'il avait ce jour-là, y compris sa base de données. Quand du travail neuf
> arrive sur `main`, un ancien espace ne le voit pas — et échoue de façon
> déroutante, par exemple sur `Missing script: "essai"`.
>
> **Le réflexe : en créer un neuf**, plutôt que de rattraper l'ancien. Un
> `git pull` ramènerait les fichiers mais pas la base, qui n'est montée qu'à la
> création — et l'erreur suivante serait plus obscure que la première.
>
> Supprimer l'ancien : `github.com/codespaces`, menu **⋯** → **Delete**.

### 2. Ne rien faire

**L'application démarre toute seule**, à chaque allumage de l'espace de travail
— y compris après la mise en veille. Il n'y a aucune commande à taper.

C'est délibéré : ce banc d'essai sert d'abord à essayer Atlas **depuis un
téléphone**. Y piloter un terminal suppose de viser un curseur au doigt et de
disposer d'une touche `Ctrl` qui n'existe pas. Quatre tentatives ont échoué
là-dessus — jamais sur l'application.

### 3. L'ouvrir

Comptez **une à deux minutes** après « Atlas est prêt » : le premier écran doit
se compiler. Un message apparaît alors, proposant d'ouvrir le port **3000** —
acceptez.

**Votre adresse est écrite en toutes lettres au démarrage**, dans un cadre, au
milieu du texte qui défile quand l'espace s'allume. Elle ressemble à ceci — le
début change d'un espace à l'autre, c'est le nom que GitHub a donné au vôtre :

```
https://fluffy-space-guide-g6477547xp266jj-3000.app.github.dev
```

**Mettez-la en favori la première fois.** Elle ne change plus tant que cet
espace existe, et elle s'ouvre sans passer par l'éditeur — c'est ce qui vous
sauvera le jour où l'éditeur refusera de se connecter.

Si le texte du démarrage a défilé trop vite, l'adresse est aussi déposée dans le
fichier `/tmp/adresse-atlas.txt`.

**Si la page reste blanche, rechargez-la.** L'application a probablement été
ouverte pendant sa compilation. Elle est aussi écrite noir sur blanc dans le
fichier `/tmp/essai.log`, après la ligne « L'application répond ».

### 4. Se connecter

```
demo@atlas.local
demo1234
```

### 5. Depuis votre téléphone

Ouvrez cette même adresse sur votre téléphone : c'est tout.

Rien d'autre à faire : l'adresse est ouverte dès la création de l'espace. C'est
aussi ce qui permet de faire ouvrir un lien de devis à une vraie personne, sur
son propre téléphone — la seule façon d'éprouver pour de bon le seul écran que
vos clients verront.

> **N'y mettez que des données inventées.** L'adresse est ouvrable par qui la
> possède, et le mot de passe de démonstration est écrit dans ce dépôt public.
> L'application garde son écran de connexion : ce qui est joignable, c'est la
> porte, pas le contenu — mais la clé de cette porte est publique.
>
> Pour refermer l'accès, une commande dans le terminal :
> `gh codespace ports visibility 3000:private -c $CODESPACE_NAME`

---

## Ce que vous pouvez essayer, du début à la fin

1. **Créer un chantier** avec un client, un téléphone, un e-mail. L'écran vous
   demande comment le joindre — c'est ce canal qui rendra l'envoi possible.
2. **Ajouter des photos, dicter une note vocale**, vérifier les informations.
3. **Calculer le prix**, préparer le devis.
4. **Envoyer au client** : une seule question vous est posée — *une date, ou
   deux au choix du client ?*
5. **Ouvrir le lien du client** qui vous est remis. Faites-le dans une fenêtre
   de navigation privée, pour être vraiment dans sa peau : il n'a pas de compte,
   pas de session, juste ce lien.
6. **Répondre à sa place** : accepter une date, en proposer une autre parmi vos
   jours libres, ou refuser.
7. **Revenir sur l'application** : le chantier s'est planifié tout seul, ou un
   « devis retourné » vous attend sur l'accueil.
8. **Onglet Terminés** : une fois la date passée, « Fin de chantier » construit
   la facture depuis le devis. Vous confirmez son départ.
9. **Relevé de TVA collectée** : la facture y figure aussitôt.

Pour voir l'onglet Terminés se remplir sans attendre, planifiez un chantier à
une date proche : il y apparaît le jour venu.

---

## Ce qui ne marchera pas, et pourquoi

- **Rien ne part réellement chez le client** — ni SMS, ni e-mail. Le lien vous
  est remis à l'écran, à vous de le transmettre. C'est le point 5 de
  [`A-FAIRE.md`](A-FAIRE.md), et cela vaut aussi bien ici qu'en production.
- **L'assistant et la transcription tournent en mode déterministe** *par
  défaut* : ils répondent sans appeler aucun prestataire. C'est délibéré —
  envoyer des données d'essai à un fournisseur qui ne figure dans aucun contrat
  serait précisément l'écart décrit au point 1 de `A-FAIRE.md`.
  **Vous pouvez le brancher pour vos propres essais** : voir juste en dessous.
- **Les fichiers sont stockés sur le disque du banc d'essai.** Ils disparaissent
  avec lui. En production, ce mode est refusé au démarrage.
- **Vos données d'essai vivent dans l'espace de travail, pas ailleurs.**
  L'application a bien une mémoire — une base de données qui survit aux
  redémarrages et à la mise en veille de trente minutes. Mais **elle meurt avec
  l'espace de travail** : le supprimer efface vos chantiers, et les données de
  démonstration repartent à zéro. Un banc d'essai est jetable par construction ;
  c'est l'hébergement (point 3 de [`A-FAIRE.md`](A-FAIRE.md)) qui donnera à
  Atlas une mémoire qui dure.

---

## Brancher une vraie IA sur vos essais

Vous n'êtes pas obligé d'attendre le contrat du point 2 pour **vos** essais :
ce sont vos chantiers, vos clients, votre décision. Le contrat devient
obligatoire le jour où Atlas sert **quelqu'un d'autre**.

Comptez une vingtaine de minutes, et **entre 2 et 7 € par mois** à votre volume
(le détail est dans [`TRANSCRIPTION.md`](TRANSCRIPTION.md) §7).

### 1. Ouvrir les deux comptes

| | Où | Ce qu'il faut y faire |
|---|---|---|
| **Rédaction** | `console.anthropic.com` | Créer un compte, y mettre 5 € de crédit, générer une clé API |
| **Transcription** | `platform.openai.com` | Idem. **Puis vérifier, dans les réglages de l'organisation, que le partage de données pour l'entraînement est bien refusé** |

Ce second geste est le plus important des deux, et celui qu'on oublie. C'est la
question 3 de `TRANSCRIPTION.md`.

> **Ce que je ne sais pas, et que vous verrez à l'écran.** Je ne peux pas lire
> les pages d'OpenAI depuis l'environnement de développement — elles me
> répondent `403`. Je ne sais donc pas si ce réglage est déjà au bon endroit
> chez eux ou s'il faut le changer : **regardez-le, ne le supposez pas.** Le
> réglage porte un nom du genre *data controls* ou *sharing for model
> improvement*. S'il n'existe pas, ou si le libellé ne dit rien de clair,
> écrivez-leur avant d'envoyer la voix d'un client.

### 2. Poser les clés dans les secrets du dépôt

Sur GitHub : **Settings → Secrets and variables → Codespaces → New repository
secret**. Quatre secrets à créer :

| Nom | Valeur |
|---|---|
| `LLM_PROVIDER` | `anthropic` |
| `ANTHROPIC_API_KEY` | la clé générée chez Anthropic |
| `TRANSCRIPTION_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | la clé générée chez OpenAI |

**Ne collez jamais une clé dans un fichier du dépôt, ni dans une conversation.**
Un secret posé ici ne se relit pas, y compris par vous — c'est voulu.

### 3. Redémarrer l'espace de travail — **et non le supprimer**

> ⚠️ **Supprimer un espace de travail efface toutes vos données d'essai.**
> Chantiers, devis, factures : tout part avec lui, et les données de
> démonstration sont réinstallées à neuf. Ne le supprimez que si vous y tenez.

Un espace **déjà allumé** ne voit pas un secret créé après lui — mais un
**redémarrage** suffit à le lui faire lire, sans rien perdre.

Sur `github.com/codespaces`, menu **⋯** → **Stop codespace**, puis rouvrez-le.

> **Ce que je n'ai pas pu vérifier.** Je n'ai pas de Docker dans mon
> environnement : je n'ai jamais vu un secret traverser jusqu'à l'application.
> Le redémarrage *devrait* suffire. **La façon de le savoir en dix secondes :**
> ouvrez **Réglages** et lisez le bloc « Ce que l'application utilise ». S'il
> nomme OpenAI et Anthropic, c'est bon. S'il dit « mode déterministe », le
> secret n'est pas arrivé — et là seulement, recréez l'espace.

**Le second piège, lui, impose bien une recréation** : un espace créé depuis
`main` ne verra jamais vos clés, parce que c'est la branche
`claude/dictee-mode-essai-qqhcsn` qui porte le passage des secrets jusqu'au
conteneur. Tant qu'elle n'est pas fusionnée, `main` fige `LLM_PROVIDER: dev` en
dur. Une fois la fusion faite, la question ne se pose plus.

### 4. Vérifier que c'est bien branché

Dictez une note vocale et regardez ce qui revient. Si vous lisez
« **[Transcription simulée — … octets reçus]** », c'est que le mode
déterministe tourne encore : le secret n'est pas arrivé jusqu'au conteneur, le
plus souvent parce que l'espace de travail est l'ancien.

Vos mots à l'écran : c'est branché.

---

## Repartir de zéro

Pour effacer vos essais et retrouver les données de démonstration :

```
npm run essai:reinitialiser
```

## Fermer proprement

Un espace de travail inutilisé s'arrête tout seul après trente minutes, et ne
consomme rien tant qu'il est arrêté. Le rouvrir prend quelques secondes et
**garde vos données**.

Pour tout effacer : `github.com/codespaces`, puis supprimer l'espace.

Le compte gratuit inclut 60 heures par mois, largement de quoi essayer.

---

## Si quelque chose ne va pas

**L'éditeur affiche « The workbench failed to connect to the server », « An
unexpected error occurred that requires a reload of this page », ou « Déconnecté
de codespace » en bas de l'écran.** Ce n'est pas Atlas : c'est **l'éditeur** qui
n'a pas réussi à joindre l'espace de travail. L'application, elle, n'est pas
concernée — elle tourne dans l'espace, pas dans l'éditeur.

C'est le cas typique du téléphone : l'espace s'était endormi, l'éditeur a voulu
se reconnecter, et il a renoncé avant que le réveil ne soit terminé
(« deadline exceeded » = *j'ai attendu trop longtemps*).

Dans l'ordre :

1. **Touchez « Reload ».** Neuf fois sur dix l'espace a fini de se réveiller
   entre-temps.
2. Si le message revient : rouvrez l'espace depuis `github.com/codespaces`
   (cela redémarre un espace arrêté, ce qu'un simple rechargement ne fait pas).
3. **Surtout : n'attendez pas l'éditeur pour vous servir d'Atlas.** L'application
   démarre toute seule à chaque allumage et son adresse est ouverte — ouvrez
   **le favori** que vous avez enregistré au geste 3.

   Si vous ne l'avez pas encore enregistré, l'adresse se recompose à partir de
   celle de l'éditeur, en deux modifications :

   | | |
   |---|---|
   | l'éditeur | `https://fluffy-space-guide-g6477547xp266jj.github.dev` |
   | Atlas | `https://fluffy-space-guide-g6477547xp266jj`**`-3000.app`**`.github.dev` |

   Autrement dit : **ajoutez `-3000` juste avant le premier point**, et
   **`app.` juste après**. Le début — le nom que GitHub a donné à votre espace —
   ne se touche pas : recopiez-le tel qu'il est chez vous.
4. Si l'espace date d'avant le 2026-08-01, supprimez-le et créez-en un neuf :
   le démarrage automatique et le port ouvert sont lus **à la création**
   (encadré du geste 1).

**La page reste blanche depuis le téléphone.** Blanche, pas crème : ce n'est pas
un écran de l'application qui s'affiche mal, c'est qu'aucune page n'arrive.
Trois causes, dans l'ordre de fréquence :

1. **L'application n'est pas encore prête.** C'est de loin la cause la plus
   fréquente. Le premier écran met une à deux minutes à se compiler après
   l'allumage. **Attendez, puis rechargez la page** — ne concluez rien avant.
2. **L'espace de travail s'est endormi.** Il se met en veille tout seul après
   trente minutes sans activité, et l'adresse ne mène alors nulle part.
   Rouvrez-le depuis `github.com/codespaces` : l'application redémarre seule,
   et vos données sont intactes.
3. **L'espace est trop ancien.** Le démarrage automatique et le port public sont
   lus **à la création** de l'espace. Un espace né avant le 2026-08-01 les
   ignore, quoi qu'on fasse ensuite — un `git pull` n'y change rien.

   **Supprimez-le et créez-en un neuf** (encadré du geste 1). C'est le seul
   chemin qui ne demande de viser aucun bouton sur un écran de téléphone.


**`Missing script: "essai"`, ou des fichiers manquent dans la liste de gauche
(`.devcontainer`, `HANDOVER.md`, `TODO.md`…).** L'espace de travail a été créé
avant que ce travail n'arrive sur `main` : il est resté à la version de ce
jour-là. Supprimez-le et recréez-en un — voir l'encadré du geste 1. C'est le
cas le plus fréquent, et le plus déroutant, parce que l'erreur ne dit pas que
le problème est l'ancienneté de l'espace.

**`EADDRINUSE: address already in use 0.0.0.0:3000`.** L'application tourne
déjà — elle démarre toute seule à l'allumage de l'espace. Ce n'est pas une
panne.

**Mais un `git pull` ne suffit jamais à appliquer un correctif.** Le serveur
charge le code une fois, au démarrage : tant qu'il n'est pas relancé, il
continue de servir l'ancienne version. Un correctif fusionné, récupéré, et
pourtant sans effet — c'est exactement ce qui s'est produit le 2026-08-02.

Une seule ligne fait tout, dans l'ordre :

```
git pull; pkill -f "[n]ext dev"; sleep 3; npm run essai
```

> **Les crochets autour du `n` sont indispensables.** `pkill -f` compare la
> ligne de commande entière de chaque processus, y compris celle du terminal qui
> joue la commande : sans eux, le motif se trouve lui-même et tue la commande
> avant qu'elle n'ait rien fait.

**Le terminal affiche une erreur pendant la préparation.** Elle s'arrête à la
première anomalie plutôt que de continuer à moitié — le message dit laquelle.
Relancez `bash .devcontainer/preparer.sh`.

**Une action ne fait rien** (créer un chantier, envoyer un devis). C'est le
symptôme d'une origine refusée par Next.js derrière le proxy. Le dépôt gère ce
cas (`next.config.ts`, `allowedOrigins`) ; si cela se reproduit, le nom de
l'espace a changé — arrêtez puis relancez `npm run essai`.

**Le port 3000 est déjà pris.** Un serveur tourne encore. Fermez-le avec
`Ctrl+C` dans son terminal.
