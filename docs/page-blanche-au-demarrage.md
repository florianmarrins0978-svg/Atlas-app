# « L'appli ne démarre pas, page blanche » — ce qui a été trouvé

2 septembre 2026. Document de retour du lot.

---

## En trois lignes

Votre espace tournait. Ce qui était cassé, c'est **la fiche qui vous dit ce qui
ne va pas** : elle affirmait quatre choses fausses, dont une qui vous envoyait
rallumer l'espace — le seul geste qui empêche l'application de revenir.

La panne elle-même n'est **pas** corrigée. Elle est maintenant *visible*, ce
qu'elle n'était pas.

---

## Ce que votre espace a publié, et pourquoi c'était trompeur

À 18 h 40 (allumage), puis à 18 h 55 (le veilleur), votre fiche portait ceci —
à trois lignes d'écart :

```
Serveur : NE RÉPOND PAS sur le port 3000
⚠ … l'application est donc entière et rapide …
```

Les deux ne peuvent pas être vraies ensemble. Et c'est la seconde qu'on lit :
elle fait chercher le défaut dans l'application, alors que rien ne servait.

---

## Un point, un verdict

| # | Ce qui était écrit | Vrai ? | Ce qui a été fait |
|---|---|---|---|
| 1 | « Arrêtez puis rouvrez l'espace de travail » — publié **à l'allumage** | **Faux, et nuisible** | Retiré à ce moment-là. À l'allumage, votre banc n'a pas encore démarré : rallumer **jette la construction qui allait partir**. Vous rallumez, vous retombez sur la même fiche, vous rallumez encore |
| 2 | « La version rapide ne se recompile jamais » | **Faux depuis le 31 août** | Votre banc rebâtit tout seul dès que le code a changé, et le veilleur retente toutes les demi-heures. La fiche disait déjà l'inverse deux points plus haut : elle se contredisait |
| 3 | « L'application est entière et rapide » | **Non mesuré** | Ce point-là répond à « quel code est servi », pas à « est-ce que ça tourne ». Il ne le prétend plus. Une seule ligne répond à cette question : « Serveur » |
| 4 | « Serveur : NE RÉPOND PAS » | **Vrai mais incomplet** | Cette phrase valait pour deux situations opposées : *plus rien n'écoute* (le banc n'a pas démarré) ou *quelque chose tient le port sans répondre* (le veilleur va le déloger, une minute d'attente). Elle les distingue désormais |
| 5 | « Le veilleur devrait le relever dans quinze secondes » | **Faux pendant une construction** | Un banc qui construit tient un verrou ; celui que le veilleur relance refuse alors de démarrer. Tant que la construction dure, personne ne prend le port. C'était **exactement** votre état à 18 h 55 : il n'y avait rien à attendre |

---

## Ce qui n'a PAS été corrigé, et qu'il faut lire

**Pourquoi rien ne servait sur votre port.** Votre fiche de 18 h 55 montrait
trois choses ensemble :

- une construction en cours ;
- une version rapide déjà bâtie et utilisable (`ddf69f2`) ;
- **rien sur le port 3000.**

Depuis le 31 août, le banc doit servir la version bâtie précédente **pendant**
qu'il construit la neuve. Elle existait. Elle n'a pas pris le port, et **on ne
sait pas pourquoi**.

**Ce n'a pas pu être reproduit ici.** Sur ce poste, au même code que le vôtre,
le banc démarre et sert : l'écran de connexion répond du premier coup. La
réponse est dans le journal de votre machine (`/tmp/essai.log`), auquel je n'ai
pas accès depuis ici.

Ce lot rend donc la fiche capable de **nommer** cet état au lieu d'affirmer que
tout va bien. Il ne répare pas la panne, et personne ne doit croire le
contraire.

---

## Ce qu'il faut faire maintenant

1. **Rallumez votre espace** (github.com/codespaces) et **attendez cinq
   minutes** sans recharger.
2. Si l'adresse reste blanche, **lancez `claude` dans votre espace** et
   dites-lui : *« regarde /tmp/essai.log et dis-moi pourquoi le serveur ne
   prend pas le port »*. Lui y a accès, moi non.

Rien d'autre à taper.

---

## Ce qui le tient, et comment on sait que ça marche

`npx tsx scripts/test-banc-lent-se-dit.ts` — cinq contrôles neufs. **Tous ont
été vérifiés rouges contre la version d'avant** : un contrôle qui n'a jamais
échoué ne prouve rien. Le cas du port occupé est joué en tenant vraiment le
port avec un processus voisin, pas en recopiant une phrase.

La batterie complète (`npm run verifier:avant-livraison`) a été jouée avant
livraison.

Raisons et pièges, pour une prochaine session : `ARCHITECTURE.md` §237.
Ce qui reste ouvert : `TODO.md`.
