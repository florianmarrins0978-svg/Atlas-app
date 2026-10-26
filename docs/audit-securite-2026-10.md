# Audit de sécurité d'octobre 2026 : le rapport final

*Du 25 au 26 octobre 2026. Il suit le prompt renforcé (`docs/audit-securite-prompt-renforce.md`, §6). Chaque faille corrigée a été reproduite d'abord par un test rouge, corrigée là où elle naît, puis vue verte ; le test reste dans la batterie.*

## Ce qu'on ne promet pas

Ni « aucune faille », ni « l'application est sûre ». Ce document dit ce qui a été attaqué, ce qui a tenu, ce qui a été corrigé, et ce qui n'a pas été regardé.

## Le verdict en cinq lignes

1. **Le cloisonnement entre artisans tient.** Aucune lecture ni écriture d'une entreprise chez une autre n'a été trouvée ; la base le garantit désormais aussi pour les liens entre tables (E10).
2. **Les failles étaient DANS une entreprise** (ce qu'un commercial ou un salarié pouvait faire en écrivant sa requête à la main) **et sur ton espace** (deux clés écrites dans le dépôt public). Toutes corrigées.
3. **Un compte volé coûte moins cher** : sessions limitées à trente jours, gestes sensibles qui redemandent le mot de passe, IA plafonnée par mois.
4. **Trois points restent à faire hors du code** : une restauration de sauvegarde à jouer chez toi, la sauvegarde hors de la machine, et ce qui se règle chez l'hébergeur le jour de la mise en ligne.
5. **Un test d'intrusion par un professionnel extérieur** reste recommandé avant le premier artisan payant : cet audit a été fait par l'outil qui a écrit le code.

## Ce qui a été corrigé

| Quoi | Gravité | Où c'est écrit |
|---|---|---|
| Next.js, React, zod et Sentry : les failles publiées d'octobre | critique (pas exposé pour deux) | `ARCHITECTURE.md` §499 |
| Un `npm test` ou un `db:seed` tapé chez toi n'efface plus tes données | élevée | §498 |
| L'IBAN ne change plus sans redemander le mot de passe, par aucun écran | élevée | §500 |
| La clé de session de ton espace n'est plus celle du dépôt public (E1) | élevée | §503 |
| Un commercial ne réécrit plus l'identité ni l'IBAN ; un salarié ne pose plus de remise ; les écritures ne prennent plus de champs en trop (E2 à E7) | élevée | §502 |
| Un écran fermé à un rôle le reste quand on y arrive par un clic (E8) | élevée | §504 |
| L'application perd trois droits qu'elle n'employait pas (E9) | moyenne | §503 |
| Les liens entre tables restent dans la même entreprise (E10) | moyenne | §510 |
| Donner, changer ou retirer un accès redemande le mot de passe (E11) | moyenne | §507 |
| Les lignes du devis ne se mêlent plus aux règles données à l'IA (E13) | moyenne | §508 |
| Un plafond mensuel de crédits IA par formule (E13) | moyenne | §509 |
| Les outils de GitHub figés par empreinte, droits réduits (E15) | moyenne | §511 |
| La clé de la purge planifiée propre à ton espace | faible | §512 |
| Les conditions à accepter arrêtent aussi le clic suivant | faible | §512 |
| Deux routes bornées, les adresses e-mail hors des journaux | moyenne | §501 |
| Une session dure trente jours après la connexion, pas davantage | moyenne | §513 |
| Une ligne de devis refuse un prix négatif ou démesuré envoyé à la main | faible | §513 |
| Les commandes du terminal de ton espace lisent la bonne clé | faible | §513 |

## Les onze scénarios d'attaque

| Scénario | Verdict |
|---|---|
| 1. Isolation entre entreprises | **tient**, renforcée par E10 |
| 2. Sans connexion : actions, liens publics, énumération | **tient** ; une adresse e-mail se devine encore par le mot de passe oublié (E17, faible, gardé) |
| 3. Pannes : base, Redis, stockage, IA, courriel | **tient** : Redis en panne bascule sur un compteur en mémoire ; le stockage est écrit avant la base, donc rien à moitié fait ; l'IA en panne rend la saisie à la main |
| 4. L'argent | **tient** : montants recalculés par le serveur, devis et factures figés par la base une fois émis ; nombres impossibles refusés depuis §513 |
| 5. Le compte volé | **corrigé** : trente jours au plus, se déconnecter révoque, changer le mot de passe coupe tout, gestes sensibles protégés |
| 6. L'IA | **corrigé** (E13 et le plafond) ; ses réponses ne sont jamais affichées comme du HTML |
| 7. Fichiers | **tient** : localisation GPS retirée des photos, HEIC brut refusé, seuls JPEG, PNG et WebP passent, archives bornées |
| 8. Requêtes vers l'extérieur | **tient** : une seule adresse venue d'une donnée (agenda Apple), filtrée et revérifiée à chaque redirection |
| 9. Chaîne logicielle | **corrigé** (E15) ; le délai avant une version neuve attend npm 11.10 |
| 10. Ton espace | **tient** : la base et Redis ne sont pas joignables de l'extérieur, seul le port de l'appli est public |
| 11. Sauvegardes | **à faire chez toi** : l'outil existe, il n'a jamais été joué sur une vraie sauvegarde (voir plus bas) |

## Ce qui a été refusé, et pourquoi

| Proposition | Pourquoi non |
|---|---|
| Stocker les liens des clients en empreinte, les faire expirer (E12) | tu ne pourrais plus recopier le lien d'un devis envoyé, et ton client perdrait le contrat qu'il a reçu |
| Fermer la page de diagnostic sans compte (E16) | elle sert justement quand on ne peut pas se connecter, et ne porte aucun secret |
| Protéger la résiliation par mot de passe | tu l'as voulue facile ; elle ne coupe rien avant la date payée et s'annule |
| Poser `min-release-age` maintenant | ignoré en silence par npm 10.9, donc une protection qui n'en est pas une |

## Ce qui reste, et qui le fait

| Quoi | Qui | Comment |
|---|---|---|
| Jouer une restauration de sauvegarde | toi, sur ton espace | `npm run sauvegarder:banc`, puis `npx tsx scripts/eprouver-restauration.ts` suivi du nom du fichier créé. Il restaure dans une base à part, ne touche pas la tienne, et vérifie 9 propriétés |
| Une sauvegarde hors de la machine, automatique | toi, au choix de l'hébergeur | dépend de l'hébergement de production |
| `ATLAS_PROXY_SAUTS`, en-têtes, rétention du journal | toi, le jour de la mise en ligne | déjà dans `docs/cloture-avant-premier-artisan.md` |
| Ton entreprise sans plafond d'IA | toi, le jour J | `npm run ia:sans-plafond -- ton@adresse`, puis rallumer |
| Revalider les anciens liens entre tables (E10) | une session, plus tard | mesurer d'abord sur ta base, puis une migration à part |
| Un test d'intrusion extérieur | toi | avant le premier artisan payant |

## Ce qui n'a PAS été vérifié

- un scan automatique d'une application en ligne (ZAP) et un test de charge : il n'y a pas encore de production ;
- les réglages du site GitHub (protection de la branche `main`, droits par défaut des flux) : pas lisibles d'ici ;
- la phrase « Crédits IA épuisés » dans l'écran de dictée avec une vraie transcription : pas de clé d'IA sur ce poste ;
- tout ce qui dépend de l'hébergeur de production.

## Ce qu'un test d'intrusion extérieur devrait couvrir

1. les rôles dans une entreprise, en écrivant les requêtes à la main (le gros des failles trouvées ici) ;
2. les liens publics (devis, facture, contrat, comptable) : rejeu, détournement, énumération ;
3. le compte volé : cookie copié, Face ID, double vérification ;
4. le crochet de paiement et les remboursements ;
5. l'IA : consignes cachées dans une dictée, une photo ou un fichier importé ;
6. l'hébergement réel : en-têtes, relais, sauvegardes, accès à la base.
