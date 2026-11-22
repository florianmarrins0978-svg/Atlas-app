# La nourrice en 3D dans l'appli et sur le site : le retour

*22 novembre 2026. Sa demande : « mets-moi exactement cette planche dans l'application, quand il propose 1 à 6 réseaux avec le goutte-à-goutte [...] et sur le site Cause 2, à la place de la photo de l'ancienne nourrice ».*

## Ce qui est fait

| Point | Verdict | Où |
|---|---|---|
| La 3D dans l'écran du plan | **fait** : elle remplace le dessin de la nourrice, de 1 à 6 voies, goutte-à-goutte compris | `src/app/paysage/arrosage/Nourrice3D.tsx`, monté par `NourriceEclatee.tsx` |
| Toucher : éclate, retoucher : remonte | **fait**, le même geste que la planche (le même code) | `appli/nourrice-3d/vue.js` |
| Déplacer, zoomer | **fait** : un doigt tourne, deux doigts rapprochent et déplacent ; à la souris, molette et clic droit | les commandes de la planche |
| Montée / Éclatée, De biais / Dessus / De face | **gardés** | `Nourrice3D.tsx` |
| Sur le site, le geste joué tout seul (sa seconde demande) | **fait** : un rond se pose comme un doigt, la nourrice s'éclate, reste ouverte 3 s, se remonte, et recommence tant qu'elle est à l'écran. Le premier toucher du visiteur l'arrête | `appli/vente/outils.html` |
| Sur le site | **fait** : la photo `outils-nourrice.jpg` est remplacée par la 3D vivante, trois voies dont une en goutte-à-goutte. La page « Cause 2 » y mène par « Découvrir les outils » | `appli/vente/outils.html` |

## Ce qui a été fait autrement, et pourquoi

- **Un seul code pour la planche, le site et l'appli.** Le geste du toucher vivait dans la planche ; le recopier deux fois l'aurait fait diverger. Il est sorti dans `appli/nourrice-3d/vue.js`, et la planche l'emploie aussi (elle se comporte comme avant).
- **Les boutons « Combien de voies » ne sont pas dans l'appli** : le nombre de voies et de goutte-à-goutte vient du plan calculé.
- **Sans 3D possible (vieux téléphone, WebGL coupé), l'appli montre le dessin d'avant**, plutôt qu'une phrase : l'artisan garde sa nourrice. Le site dit une phrase.
- **La scène sait maintenant se défaire.** Sans cela, chaque ouverture de l'écran du plan aurait laissé tourner une 3D en arrière-plan, jusqu'à ce que le téléphone refuse.
- **Sur le site, la 3D ne se charge qu'en approchant de la nourrice** : la page reste légère pour qui ne descend pas jusque-là. Une ligne sous elle dit « Touchez la nourrice pour l'éclater. », puisqu'il n'y a pas de bouton.

## Ce qui est perdu, et qui se dit

- **Une pièce supprimée ou changée ne se voit plus SUR la nourrice** : le dessin la grisait et la barrait (sa demande du 19 octobre). La légende dessous le dit toujours, en rouge barré ou en doré. Le poser dans la 3D est faisable : à décider.
- **Un glissé posé sur la 3D la tourne au lieu de faire défiler la page.** C'est le prix du geste demandé ; on défile en posant le doigt à côté.

## Vérifié, et ce qui ne l'est pas

| | |
|---|---|
| types, lint, construction de l'appli | verts ; la 3D et son éclairage partent bien avec l'appli |
| contrôles rapides (couches, code mort, tirets, couleurs, flèches, nom Cause, pansements, chartes) | verts |
| la planche et le site, dans Chromium sans écran | éclaté et remontée au toucher, 0 erreur de composition, 0 erreur de page, au téléphone et à l'ordinateur |
| **l'écran du plan dans l'appli** | **pas regardé ici** : il faut un serveur de développement, donc son oui |
| **la batterie** | **pas jouée** : le lot touche `package.json` (niveau 3), elle attend son oui |
| un iPhone | pas éprouvé (rendu logiciel ici) |

## Ce qui reste ouvert

| | Qui |
|---|---|
| lancer la batterie, puis pousser sur `main` | lui, un oui |
| griser les pièces supprimées dans la 3D | lui, à décider |
| retourner le film `outils-nourrice` du site, qui montre l'ancien dessin dans le téléphone | une session, une fois sur `main` |
