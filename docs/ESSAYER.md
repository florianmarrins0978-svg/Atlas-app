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
5. [Repartir de zéro](#repartir-de-zéro)
6. [Fermer proprement](#fermer-proprement)
7. [Si quelque chose ne va pas](#si-quelque-chose-ne-va-pas)

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

L'adresse se devine aussi toute seule : c'est le nom de l'espace, visible dans
la barre d'adresse de l'éditeur, suivi de `-3000.app.github.dev`.

```
https://<nom-de-l-espace>-3000.app.github.dev
```

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
- **L'assistant et la transcription tournent en mode déterministe** : ils
  répondent sans appeler aucun prestataire. C'est délibéré — envoyer des données
  d'essai à un fournisseur qui ne figure dans aucun contrat serait précisément
  l'écart décrit au point 1 de `A-FAIRE.md`.
- **Les fichiers sont stockés sur le disque du banc d'essai.** Ils disparaissent
  avec lui. En production, ce mode est refusé au démarrage.

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

**Le terminal affiche une erreur pendant la préparation.** Elle s'arrête à la
première anomalie plutôt que de continuer à moitié — le message dit laquelle.
Relancez `bash .devcontainer/preparer.sh`.

**Une action ne fait rien** (créer un chantier, envoyer un devis). C'est le
symptôme d'une origine refusée par Next.js derrière le proxy. Le dépôt gère ce
cas (`next.config.ts`, `allowedOrigins`) ; si cela se reproduit, le nom de
l'espace a changé — arrêtez puis relancez `npm run essai`.

**Le port 3000 est déjà pris.** Un serveur tourne encore. Fermez-le avec
`Ctrl+C` dans son terminal.
