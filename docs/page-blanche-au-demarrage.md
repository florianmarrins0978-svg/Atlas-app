# « L'appli ne démarre pas, page blanche » — ce qui a été trouvé

2 septembre 2026. Document de retour du lot.

---

## En trois lignes

`npm ci` effaçait `node_modules` **pendant** qu'un serveur y travaillait. Le
dossier restait à moitié détruit, `next` disparaissait, et l'application ne
pouvait plus démarrer du tout — en boucle, toutes les quinze secondes, sans que
rien ne le dise.

C'est corrigé à la racine. Et deux garde-fous qui auraient dû l'attraper ont été
corrigés aussi.

---

## Correction de ce que j'ai dit plus tôt

**J'ai d'abord écrit que la panne n'était pas trouvée**, et que seule la fiche
avait été réparée. C'était vrai à ce moment-là, et ce ne l'est plus : ton
journal, lu depuis ton espace, portait la réponse. Ce document remplace la
version précédente.

---

## Ce qui s'est réellement passé

À 21 h 13, pendant la mise à jour de ton espace :

```
npm error ENOTEMPTY: directory not empty, rmdir '.../scope-manager/dist'
npm error ENOTEMPTY: directory not empty, rename '.../zod' -> '.../.zod-Nu9WQpaH'
```

puis, trente fois d'affilée :

```
Error: Cannot find module '.../node_modules/next/dist/bin/next'
02/09 21:21:58 — le serveur s'est arrêté
02/09 21:22:13 — plus rien n'écoute sur le port 3000, relance du serveur
```

**Le mécanisme, en trois lignes de script.** Ton espace lance d'abord
l'application — pour que tu aies toujours quelque chose qui répond —, puis
réinstalle les dépendances. Or cette réinstallation **supprime le dossier des
dépendances** avant de le refaire. L'application, elle, était en train de s'en
servir. Le dossier est resté à moitié détruit.

Ensuite, tout est cohérent : sans `next`, le serveur meurt à la seconde ; le
veilleur fait son travail et le relance ; il remeurt. Une heure.

---

## Un point, un verdict

| # | Le point | Verdict | Ce qui a été fait |
|---|---|---|---|
| 1 | L'ordre des opérations au démarrage | **la cause** | L'application est arrêtée **avant** la réinstallation, plus après. Elle était arrêtée de toute façon vingt lignes plus bas : ça ne coûte rien, et ça supprime le problème |
| 2 | La réparation automatique existait — elle s'est déclenchée | **vrai, mais insuffisante** | Elle utilisait `npm install`, qui ne sait pas réparer un dossier à moitié détruit. Elle se replie désormais sur `npm ci`, qui repart d'un dossier propre |
| 3 | « On tente la construction telle quelle » | **c'était un mur** | Sans `next`, il n'y a rien à tenter. Le banc vérifie maintenant que le paquet est **vraiment là**, et si ce n'est pas le cas il le dit sur la fiche au lieu de boucler en silence |
| 4 | L'échec d'installation au démarrage | **avalé** | Il était noyé dans un `\|\| true`. Il s'affiche maintenant, avec le geste à faire |
| 5 | La fiche de ton espace | **elle mentait** | Corrigé plus tôt dans la journée : quatre phrases fausses retirées, dont une qui t'envoyait rallumer l'espace au pire moment |

---

## Ce que ça change pour toi

| | avant | après |
|---|---|---|
| pendant une mise à jour | l'application pouvait se faire casser | plus rien ne tourne pendant ce temps |
| dépendances abîmées | boucle infinie, page blanche, aucune explication | réparation automatique complète |
| si la réparation échoue quand même | rien, nulle part | la fiche **nomme** ce qui manque, et donne la commande |

---

## Ce qui le tient, et comment on sait que ça marche

La panne a été **rejouée**, pas raisonnée : `next` écarté, cache de npm vidé,
registre injoignable — les deux commandes échouent, et le banc rend :

```
⚠️  LES DÉPENDANCES N'ONT PAS PU ÊTRE RÉPARÉES — next, eslint-config-next manque encore.
    Depuis un terminal de l'espace :  rm -rf node_modules && npm ci
```

avec la trace déposée pour la fiche.

Quatre contrôles neufs, **tous vérifiés rouges contre la version d'avant** — un
contrôle qui n'a jamais échoué ne prouve rien. Le premier jet de celui qui fixe
l'ordre des opérations était d'ailleurs **inutile** : il se laissait berner par
une ligne du haut du script et passait au vert sur le code cassé. Il est écrit
noir sur blanc ici parce que c'est le genre d'erreur qui rend tout le reste
douteux.

---

## Ce qui reste, et que je n'ai pas fait

Rien sur cette panne. Si elle revenait malgré tout, la fiche de ton espace dira
cette fois quoi taper — elle ne se contentera plus de « ne répond pas ».

Raisons et pièges, pour une prochaine session : `ARCHITECTURE.md` §237 et §238.
