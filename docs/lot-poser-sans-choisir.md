# Poser un chantier sans avoir à choisir — 9 septembre 2026

**Ce que tu as signalé :** *« quand je clique sur ajouter un chantier, lorsque je
clique sur Claudette il me propose 3 choix, alors que si Claudette c'est un
chantier 1 journée, deux, ou une demi, ça doit se mettre tout seul — je dois pas
avoir à choisir. »*

**Tu as raison, et c'était pire que ça.**

---

## Ce que les trois boutons faisaient vraiment

Ils n'avaient pas l'air d'écrire quoi que ce soit. Ils réécrivaient la **durée**
du chantier — celle qui vient de ton devis, ou de ta dictée.

| Le chantier | Un appui sur « Matin » |
|---|---|
| une demi-journée | rien de changé |
| **une journée** | **il devenait une demi-journée** |
| deux jours ou plus | rien de changé (la durée était déjà protégée) |

La ligne du milieu est le défaut. Il ne se voyait nulle part : ni sur le plan, ni
sur le devis, ni sur la facture. L'après-midi que tu croyais réservé redevenait
libre — donc proposable à un client — et tu ne l'apprenais que le jour du
chantier.

## Ce qui a changé à l'écran

| Avant | Maintenant |
|---|---|
| « + Ajouter un chantier » → le nom → **Matin · Ap.-m. · Journée** | « + Ajouter un chantier » → le nom, et c'est posé |
| dans le tiroir du bas, trois boutons par ligne | un seul bouton, **Poser** |

Un chantier d'une journée prend la journée. Une demi-journée prend la première
moitié libre. Trois jours prennent trois jours.

## Ce qui n'a pas changé, et pourquoi

**« Déplacer » garde ses trois moments.** C'est là que tu corriges — « finalement
Claudette ce sera l'après-midi » —, sur un chantier déjà posé, que tu regardes.
Là, le mot que tu choisis est une vraie demande. Le retirer t'aurait enlevé le
seul endroit d'où l'on règle un moment.

## Ce que j'ai corrigé en plus, et que personne n'avait vu

Le même défaut vivait dans l'**assistant**. Quand tu dictais « pose Claudette
jeudi » sans dire l'heure, le code remplissait « journée » tout seul : une
demi-journée vendue en réservait deux. Un moment que tu n'as pas dit n'est plus
inventé.

Et « déplace Claudette » sans dire quand est désormais **refusé** avec la
question — plutôt que de décider à ta place.

## Ce qui l'éprouve

| | |
|---|---|
| deux contrôles neufs sans navigateur | poser garde la demi-journée réservée ; poser suit ta dictée quand rien n'est encore réservé |
| deux contrôles au navigateur, réécrits | ils **touchaient eux-mêmes « Matin »** avant de vérifier la durée : ils auraient été verts sur le défaut. Ils ne touchent plus qu'un nom |

Les deux contrôles neufs ont été mis au **rouge** contre la règle inverse avant
d'être retenus — un contrôle qui n'a jamais échoué ne prouve rien.

## Ce qui reste ouvert, et c'est à toi

La maquette du planning que tu as retenue le 21 août
(`planning-simple.html`) montre encore les deux temps « qui, puis quand ». Je
n'y ai pas touché : une planche que tu as validée ne se réécrit pas sans toi.
Dis-moi si tu veux que je la reprenne.

---

**Aucune migration.** Rien n'a été ajouté au serveur : la fonction qui pose un
chantier savait déjà lire sa durée et chercher la moitié de journée où elle
tient. C'est l'écran qui refusait de l'employer.

Détail technique : `ARCHITECTURE.md` §308.
