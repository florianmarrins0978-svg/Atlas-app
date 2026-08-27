# Fusion du lot 3 sur `main` — verdict final

*27 août 2026. Ce document remplace `docs/fusion-lot-3-rapport.md`, qui rendait
un verdict provisoire sur une batterie incomplète.*

---

## Verdict

> ## FUSION VALIDÉE — PRÊTE À POUSSER SUR `main`

Rien n'a été poussé sur `main`. L'autorisation se demande.

| | |
|---|---|
| Branche | `claude/atlas-securite-lot3` |
| Tête de la branche | **5a8fcbc** |
| `origin/main` intégré | **19cd448** |
| Conflits, tour 1 | **2** — `ARCHITECTURE.md`, `scripts/test-envoi-client-e2e.ts` |
| Conflits, tour 2 | **2** — `CHANGELOG.md`, `TODO.md`, tous deux documentaires |
| Migrations nouvelles | **1** — `0068_effacement_client_devis_envoye.sql`, appliquée avant toute mesure |
| Batterie | **259/259 base · 115/115 navigateur · connexion derrière proxy verte** |

**Deux tours de fusion, deux batteries complètes.** `main` a bougé pendant la
première : dix commits de plus, dont une migration. La règle du dépôt est nette —
migration nouvelle = l'appliquer, puis batterie complète. C'est ce qui a été
fait, et les chiffres ci-dessus sont ceux du **second** tour, sur `19cd448`.

---

## 1. La correction attendue est arrivée, et elle est saine

`15ee55d — Désamorcer trois suites qui rougissaient en fin de mois et sous la charge`.

C'est le **montage** de `test-carte-reponse-mene-au-geste-e2e` qui a été réparé.
**Aucune assertion n'a été abaissée** : la nouvelle version refuse même de
conclure quand la liste des dates proposées revient vide, plutôt que de rendre un
vert qui ne mesure rien.

Le diagnostic d'en face recoupe le nôtre au mot près : le calendrier de
démonstration se vide en fin de mois, la suite prenait le dernier jour cliquable
— devenu la date que l'artisan proposait déjà —, le client « acceptait » sans
surprise, ce qui ne fait volontairement aucune carte, et le contrôle accusait un
produit juste. **Vert le 26, rouge le 27, code identique.**

Vérifié après fusion : la suite est **verte**.

---

## 2. Deux collisions, chacune où les deux côtés avaient la moitié raison

### La lecture du calendrier

| | |
|---|---|
| Notre lot | avait extrait `joursAProposer` dans un module partagé — **une seule implémentation** — mais datait son plancher à Greenwich |
| `main` | avait écrit l'équivalent en place, avec la **bonne** correction de fuseau (`jourIso`) |

Garder les deux aurait fait deux implémentations de la même règle, ce que
`CLAUDE.md` §3 interdit — elles divergent toujours. Le module partagé reste, la
correction de fuseau y entre.

### `ARCHITECTURE.md` §199, pris des deux côtés le même jour

La règle dit de renuméroter **celui qui n'est pas encore sur `main`**. Les nôtres
deviennent **§200** et **§201**.

Trois renvois ont suivi le décalage. **Un quatrième s'est révélé faux depuis
toujours** : `PROJECT_STATE.md` envoyait en §199 pour « je dois pouvoir
désélectionner », qui est en §191. Il n'a été trouvé qu'en relisant chaque renvoi
un par un — et c'est exactement l'argument de la dette notée dans `TODO.md` :
**un renvoi faux a l'air juste.**

---

## 3. Trois commentaires qui mentaient, redressés

1. **`retirerCleAction`** promettait *« Rien ne demande le mot de passe pour ce
   geste, et c'est délibéré »* — alors que la garde M11 est posée **deux lignes
   plus bas** depuis le 25 août. Une prochaine session l'aurait lu et se serait
   crue autorisée à retirer la garde. Le vrai arbitrage est écrit à la place :
   c'est « Me déconnecter partout » qui sert le téléphone perdu, sans preuve ;
   la liste des portes ne se défait qu'en prouvant qui l'on est.
2. **`NoteVocaleClient.tsx`** citait `verifierTypeAudio`, morte avec le lot Audio.
3. Le renvoi §199 ci-dessus.

Aucun comportement ne change : ce sont des commentaires. Mais un commentaire
périmé est pire qu'absent — on s'y fie encore.

---

## 4. Les contrôles critiques, un par un, avec ce qui les prouve

| Contrôle | Ce qui le prouve | Verdict |
|---|---|---|
| **M9** — condensat hors de portée d'`atlas_app` | `test-secret-authentification-db` — 18 contrôles | vert |
| **M11 geste 1** — IBAN / coordonnées bancaires | `test-gestes-sensibles-db` — 8 cas, action serveur réelle sous `atlas_app` | vert |
| **M11 geste 2** — ajout d'une clé Face ID | `test-face-id-e2e` — « UNE SESSION SEULE NE SUFFIT PLUS », avec `count(*) = 0` en base | vert |
| **M11 geste 3** — retrait d'une clé Face ID | `test-gestes-sensibles-db` — 3 cas, dont « la clé est toujours là » | vert |
| **M11 geste 4** — export complet | `test-mes-donnees-e2e` — export de 684 496 octets obtenu APRÈS la feuille de preuve | vert |
| **Coupure globale des sessions** | `test-coupure-sessions-e2e` — « le contournement échoue : la coupure tient » | vert |
| **M12 / rôles** | `test-acces-roles-db`, `test-acces-salarie-e2e` (8 contrôles) | vert |
| **RLS / isolation** | suites base : lecture, écriture, mise à jour, fail-closed, `NOBYPASSRLS` | vert |
| **F2** — `/api/session-perimee` | `test-session-perimee-e2e` — 8 contrôles | vert |
| **F5** — contexte vide | `test-isolation-contexte-vide-db` | vert |
| **F8** — gardes des réglages | `test-reglages-gardes` | vert |
| **Porte audio** | `test-signature-audio` (31) + `test-audio-entrant-db` (9) ; les 4 chemins d'entrée passent par `preparerAudioEntrant`, aucun ne le contourne | vert |

**Correction d'un de mes propres rapports.** J'ai résumé M11 par « les trois
gestes » dans des rapports précédents. Il y en a **quatre** — mon « trois »
comptait des FICHIERS de garde, pas des gestes. La correction du patron était
juste, et les quatre sont désormais prouvés séparément ci-dessus.

---

## 5. Ce qui a empêché la batterie de tourner d'une traite — et qui n'est PAS le code

La batterie a été tuée deux fois par le **manque de mémoire** avant d'être
comprise. Mesuré plutôt que supposé, en relevant la mémoire du serveur toutes
les cinq secondes :

| | |
|---|---|
| les 13 premières suites | serveur **plat à 2,0–2,4 Go** — aucune croissance |
| `test-coupure-sessions-e2e` | 2,8 → **5,9 Go** en quelques secondes |
| ensuite, **sans plus une seule requête** | montée continue jusqu'à **13,5 Go**, puis le serveur est abattu |

Les fils qui brûlent le processeur pendant cette montée sont les `tokio-rt` :
c'est **Turbopack**, le compilateur de Next. Le fil JavaScript d'Atlas est au
repos, et le journal du serveur ne montre plus aucune requête — **ce n'est pas du
code d'Atlas qui alloue.**

**La suite, elle, PASSE** : jouée seule, 1/1. Ce qui meurt, c'est la suite
d'après, emportée avec le serveur — d'où un rouge qui accusait `test-cron-purge`
alors qu'elle n'avait jamais été lancée.

**Comment la mesure a été obtenue malgré ça :** les 115 suites ont été jouées par
tranches, un serveur neuf par tranche, et les suites jamais lancées ont été
rejouées seules. **Aucune assertion touchée, aucun délai ajouté, aucune suite
écartée.** Une suite « jamais jouée » n'a jamais été comptée comme réussie : elle
a été JOUÉE.

**Ce qui reste ouvert, et n'est pas présenté comme réglé :** la même batterie a
tourné d'une traite sur 115 suites deux heures plus tôt, dans ce même conteneur.
Ce qui a changé entre les deux n'est pas établi. C'est écrit dans `TODO.md` comme
**non diagnostiqué**, avec la piste la plus courte pour le trancher.

**Et le phénomène est INTERMITTENT** — donnée du second tour : les mêmes 115
suites, dans les mêmes tranches, sont passées **sans une seule mort de serveur**,
`test-cron-purge` comprise. Une cause qui va et vient n'est pas une cause dans le
code — celui-ci n'a pas changé, pour ce qui touche cette suite, entre les deux
tours. Raison de plus pour ne pas écrire que c'est réglé.

---

## 6. Deux erreurs de ma part, corrigées noir sur blanc

1. **J'ai d'abord accusé le cache froid.** Ayant supprimé `.next` avant la
   première batterie, j'ai annoncé que la recompilation à froid expliquait les
   13,5 Go. **C'était faux** : la seconde batterie, cache chaud, a atteint le
   même chiffre. C'est la mesure suite par suite qui a donné la vraie cause.
2. **Mon premier pilote de tranches n'a pas transmis les variables
   d'environnement.** Le dépôt a **refusé de tourner** — *« REDIS_URL n'est pas
   posée, et sans elle cette batterie ne veut rien dire »* — plutôt que de rendre
   de faux verts. Le garde-fou a fonctionné exactement comme il devait.

---

## 7. Ce qui reste ouvert

| Point | Qui peut le trancher |
|---|---|
| La batterie ne tient plus en un seul serveur — cause non établie | nous, en rejouant la suite sur 826314e et en comparant la courbe |
| Un refus de rôle sort en **500** au lieu d'un **403** sur `/api/mes-donnees` | nous, au lot suivant — la sécurité tient, c'est la forme du refus |
| `npm audit` : 4 alertes modérées, inchangées | aucune action — `drizzle-kit → esbuild`, dépendance de développement, rien n'est exécuté |
| Pousser sur `main` | **LUI**, et lui seul |
