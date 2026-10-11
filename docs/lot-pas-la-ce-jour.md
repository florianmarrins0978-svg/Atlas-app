# « Je ne suis pas là ce jour-là » — lot 5

**6 septembre 2026.** Le raccourci que vous avez validé sur la maquette
`https://florianmarrins0978-svg.github.io/Atlas-app/pas-la-ce-jour.html`.

---

## D'abord, la correction

**Je vous ai dit que les absences ne bloquaient pas les dates proposées à vos
clients. C'était faux.** Elles les bloquent depuis le 14 août, et les trois
chemins les voient : l'écran d'envoi, l'envoi lui-même, et la vérification quand
votre client répond.

Ma vérification avait été bâclée : j'avais cherché qui appelait une fonction de
lecture, alors que le calcul interroge la table directement.

**Donc ce lot n'est pas « remplacer l'agenda relié ».** C'est un raccourci, et
rien de plus.

---

## Ce qui change pour vous

| Avant | Maintenant |
|---|---|
| quitter le planning, ouvrir Réglages, puis Équipe, descendre jusqu'aux absences, taper deux dates | toucher le jour, toucher **« Je ne suis pas là »** |

- **Rien de caché** : pas d'appui long, pas de glissement. Une ligne visible
  dans la carte que vous ouvrez déjà en touchant un jour.
- **Ça se défait du même geste** : le jour fermé propose « Annuler ».
- **Un jour passé ne se ferme pas** — comme le reste du planning.
- **Avec des salariés, Atlas demande QUI**, par son nom. Seul, c'est un seul
  appui.

**Votre correction du jour, appliquée :** *« c'est pas les équipes, c'est le nom
des salariés »*. L'écran affiche le nom que vous avez saisi — ou « Salarié 2 »
tant que vous n'avez rien tapé, exactement comme l'écran des absences.

---

## Ce que je n'ai PAS ajouté, et c'est le plus important

**Aucune nouvelle façon de fermer un jour.** Le geste écrit **la même ligne**
que l'écran des Réglages — une absence d'un jour —, et c'est le calcul existant
qui retire la place. Une seconde façon de fermer un jour aurait fini par
diverger de la première, et c'est votre disponibilité qui l'aurait payé : un
jour fermé ici mais ouvert là-bas part chez un client.

Aucune migration, aucune nouvelle action serveur : tout existait.

---

## Ce que seule la capture a montré

**Le geste était en bas de la carte, et il tombait derrière le tiroir du bas.**
Les noms de vos salariés étaient coupés en deux — un geste qu'on ne peut pas
viser.

Mon raisonnement tenait pourtant : c'est le geste le moins fréquent des trois,
donc il ne devait pas passer devant vos chantiers. **Être inatteignable est
pire qu'être second.** Il est maintenant juste sous la date du jour.

**Et je n'ai pas ajouté de défilement forcé pour rattraper ça** : le dépôt en a
retiré un le 3 septembre, parce qu'il soignait le symptôme et pas la place.

---

## Le contrôle, et ce qu'il a coûté

`scripts/test-pas-la-ce-jour-e2e.ts` part du planning et touche un jour comme
vous — pas l'action serveur, sinon il resterait vert sur un écran où le geste
n'apparaît pas.

**Il mesure que le geste est ATTEIGNABLE**, pas seulement présent : c'est
exactement la nuance que la capture a révélée. Avant correction, il était bien
là — et inutilisable.

**Il sait échouer :** geste retiré, quatre de ses cinq cas rougissent.

**Il a sali la base une fois, et c'est corrigé.** Une première version a échoué
en cours de route en laissant deux absences derrière elle ; le tour suivant
trouvait un jour déjà fermé et accusait le code. Il remet maintenant le jour à
l'état ouvert avant de commencer **et** à la fin.

---

## Les chiffres de la batterie

`npm run verifier:avant-livraison`, jouée en entier sur votre poste.

| Étape | Résultat |
|---|---|
| Types, lint, construction, mémoire | **verts** — 0 erreur |
| Suites base de données | **306 / 314** |
| Suites navigateur | **114 / 131** |
| Connexion derrière un proxy | **n'a toujours pas mesuré** — la panne d'outillage Windows |

**Ma suite est verte dans la batterie**, ses cinq cas :

```
✓ le geste est là, sur un jour à venir
✓ il est ATTEIGNABLE — rien ne le recouvre
✓ un appui ferme le jour, et le serveur l'a bien écrit
✓ et il se rouvre du même geste
✓ un jour PASSÉ ne se ferme pas
```

### `test-planning-e2e` est rouge, et j'ai vérifié plutôt que supposé

C'est la suite du planning — l'écran que ce lot touche. **Je ne pouvais pas la
mettre sur le compte du hasard sans regarder.**

Dans la batterie, elle s'arrête sur une **clé de devis en double** : deux suites
qui se marchent dessus dans la même base. Jouée seule, elle va plus loin et
tombe sur un autre cas — « un samedi offre les mêmes gestes qu'un mardi ».

**Alors je suis allé mesurer l'écran lui-même**, sur un vrai samedi
(12 septembre) :

| Ce que la suite exige | Ce que l'écran rend |
|---|---|
| exactement un geste « ajouter un chantier » | **1** |
| les deux demi-journées | **2** |

L'écran satisfait donc ses deux exigences. Son rouge vient de l'état de ses
propres données, pas du planning. **Ce n'est pas une preuve que tout va bien
dans cette suite — c'est une preuve que ce lot-ci n'en est pas la cause**, et
elle reste à démêler.

---

## Ce qui reste

| | |
|---|---|
| **Google** | il faut que **vous** posiez une fois les identifiants Atlas. Ensuite, un seul bouton pour tous vos clients. Je vous fais la marche à suivre quand vous voulez |
| **Lot 6** | le dernier des Réglages : Équipe (proposition C), notifications, mot de passe, données, couleurs, IA, abonnement, compte |
| **Toujours sans réponse** | faut-il couper « Devis & factures » ? |
