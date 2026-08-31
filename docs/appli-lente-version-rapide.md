# « Elle est super lente » — 31 août 2026, midi

## Ce qui se passait

Le bandeau **« Version rapide en construction »** que tu avais en haut de
l'écran dit tout : la version rapide n'était pas construite, donc chaque page se
compilait au moment où tu l'ouvrais. D'où l'attente.

La construction échouait, et elle a échoué toute la matinée pour la même raison.

## La cause

Un morceau de l'application manquait sur ton espace (le paquet `next`). Au lieu
de s'arrêter là, l'outil de construction **allait en télécharger un autre sur
Internet** — une version différente de celle du projet — et travaillait avec.
Évidemment, ça ne marchait pas. Et ça recommençait toutes les demi-heures.

C'est aussi ce qui expliquait le « 16.3.3 » qu'on cherchait depuis deux jours
sans comprendre.

## Ce qui a été corrigé

| | |
|---|---|
| l'outil du **projet** est appelé par son chemin | plus rien ne va chercher une version sur Internet |
| un morceau manquant est **réinstallé** | avant de construire, et avant même de démarrer |
| le message d'erreur est **reconnu** | il déclenche la réparation au lieu de passer inaperçu |

## Ce que tu as à faire

**Rallume ton espace.** Il se répare tout seul au démarrage : il voit ce qui
manque, le réinstalle, construit la version rapide, et bascule dessus.

## Un défaut trouvé avant livraison, et corrigé

Le premier correctif rendait ton banc **pire** : en appelant l'outil du projet,
un paquet manquant tuait le serveur à la seconde, ce qui coupait la réparation
en plein milieu. Ça ne se voyait pas en relisant le code — seulement en le
lançant pour de bon.

La réparation a donc lieu **avant** que quoi que ce soit ne démarre. Vérifié en
retirant le paquet à la main et en lançant le banc :

> next ABSENT → réinstallation → « Dépendances remises d'aplomb » → construction
> terminée → **passage à la version rapide**

## Ce qui reste ouvert

On ne sait pas **pourquoi** ce paquet disparaît de ton espace. Le banc répare la
conséquence à chaque démarrage ; il n'empêche pas la cause. Si ça revient, la
fiche le dira avec l'heure, et on saura à quoi la rapprocher.

## Au passage

Le correctif de cette nuit a marché : ta fiche dit maintenant
« Port 3000 : ouvert — Atlas répond bien à l'adresse publique (vérifié) ».

## Où c'est écrit dans le dépôt

- `ARCHITECTURE.md` §218 — le raisonnement complet et les pièges
- `HANDOVER.md` — quoi lire devant « c'est lent »
- `scripts/banc.mjs`, `scripts/coherence-dependances.mjs` — le correctif
- `scripts/test-coherence-dependances.ts` — les contrôles, vus rouges contre
  l'ancienne version avant d'être crus
