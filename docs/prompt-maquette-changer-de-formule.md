# Le prompt de la maquette « changer de formule » (23 novembre 2026)

Il l'envoie à une autre session. Les décisions qu'il porte sont aussi dans
`TODO.md`, « TRANCHÉ : CHANGER DE FORMULE ».

```
Lis CLAUDE.md, puis fais UNE planche (maquette), sans toucher à src/.

LE SUJET : la fenêtre de confirmation quand un artisan change de formule, dans Réglages, Abonnement (src/app/reglages/abonnement/AbonnementClient.tsx).

CE QUI A ÉTÉ TROUVÉ LE 23 NOVEMBRE, en payant pour de vrai avec une clé Stripe de test sur mon espace :
1. Un seul appui sur une formule la change, SANS confirmation et SANS rien débiter (changerLaFormule dans src/server/paiement/stripe.ts, proration_behavior create_prorations). La différence attend la prochaine échéance : un client qui monte puis résilie a la formule supérieure gratuitement.
2. La descente prend effet tout de suite, alors que l'article 14.6 des conditions générales dit « à l'échéance suivante ».

MES DÉCISIONS (ne pas me les redemander) :
- MONTER (Artisan 39 € HT vers Entreprise 59 € HT, ou vers Illimité 159 € HT) : le prix ENTIER de la nouvelle formule est débité le jour du changement, qui devient la nouvelle date d'échéance. Les jours restants de l'ancienne formule ne sont PAS remboursés.
- DESCENDRE : rien n'est débité, la formule moins chère commence à la prochaine échéance. Jusque-là il garde la formule qu'il a payée.
- Nouveau texte de l'article 14.6 (pour plus tard, pas dans ce lot) : « Le passage à une formule supérieure prend effet immédiatement : son prix est dû en entier à la date du changement, qui devient la nouvelle date d'échéance. La période en cours de l'ancienne formule n'est pas remboursée. Le passage à une formule inférieure prend effet à l'échéance suivante. »

CE QUE LA PLANCHE DOIT MONTRER :
- Posée sur le VRAI écran Abonnement, figé avec scripts/planche-figee/ (figer.mjs, composer.mjs, parcourir.mjs), CLAUDE.md §3 bis point 2 quinquies. Pas d'écran redessiné.
- État de départ : abonné Artisan, prochain paiement le 23 décembre 2026.
- Appui sur Entreprise : une feuille qui dit le montant AVANT de valider. Par exemple « Entreprise, 59 € HT débités aujourd'hui (70,80 € TTC). Les jours restants d'Artisan ne sont pas remboursés. Prochain paiement le 23 janvier. » Boutons Confirmer et Annuler.
- Après Confirmer : l'écran affiche Entreprise et la nouvelle date.
- Appui sur une formule moins chère (depuis Entreprise vers Artisan) : une feuille qui dit « Artisan à partir du 23 décembre. Rien n'est débité aujourd'hui. » Après Confirmer, l'écran affiche Entreprise jusqu'au 23 décembre, puis Artisan.
- Le cas où la carte est refusée à la montée : la formule ne change pas, et une ligne le dit.
- Le moins de mots possible, ni tiret ni point médian, pas de flèche au bout des boutons. Chaque bouton fait quelque chose (§3 bis point 2 quater).

LIVRAISON : la planche dans appli/, un lien dans appli/essais.html, et l'adresse entière seulement une fois qu'elle répond 200. Je choisis, puis on code (paiement, conditions générales version 4, batterie avec mon accord).
```
