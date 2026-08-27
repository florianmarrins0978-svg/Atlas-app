# Atlas — Lot 3 : fermeture F1–F13

*25 août 2026 · branche `claude/atlas-securite-lot3` · pas encore sur `main`*

Fait suite à `docs/lot-3-f1-f13-lecture.md` (l'instruction, sans code) et à
`docs/lot-3-m11-rapport.md` (la clôture de M11).

---

## 0. Avertissement

**Le rapport d'audit qui nomme F1 à F13 n'est pas dans le dépôt.** Deux points
seulement citaient un fichier ; les onze autres ont été traités comme des
hypothèses à mesurer, jamais comme des constats acquis. C'est ce qui a permis
d'en écarter quatre sans rien casser — et l'un d'eux, F6, aurait fait rejouer
partout une migration déjà passée s'il avait été « corrigé ».

---

## 1. Traitement point par point

| | Verdict | Ce qui a changé | Contrôle |
|---|---|---|---|
| **F1** | fondé | `derniereIssueMiseAJour` exige le propriétaire | `test-mise-a-jour-role-db.ts` — 2 contrôles neufs, vus rouges |
| **F2** | fondé | `/api/session-perimee` refuse `Sec-Fetch-Site: cross-site` | `test-session-perimee-e2e.ts` — 7 → 8, vu rouge |
| **F3** | partiellement fondé | **rien** (consigne tenue) | `test-diagnostic-sans-secret.ts` — 5 neufs, vert d'emblée, vu rouge contre une variable ajoutée |
| **F4** | faux problème | rien | — |
| **F5** | fondé | migration **0067**, additive | `test-isolation-contexte-vide-db.ts` — 4 neufs, vus rouges |
| **F6** | faux problème | rien, **et aucun renommage** | — |
| **F7** | décision produit | rien | — |
| **F8** | fondé | garde de rôle sur `/reglages/agenda` | `test-reglages-gardes.ts` — 4 neufs, vus rouges |
| **F9** | fondé | cadence sur la réponse publique au devis | `test-devis-client-e2e.ts` — 11 → 12, vu rouge |
| **F10** | réel, hors lot | rien | — |
| **F11** | déjà fermé (lot 1) | rien | contrôle existant |
| **F12** | fondé | `src/app/design/layout.tsx` | `test-maquettes-hors-production.ts` — 4 neufs, vus rouges |
| **F13** | fondé | `src/app/robots.ts` + `matcher` | `test-pages-publiques-…-e2e.ts` — 6 → 7, vu rouge |

**Aucun des sept fondés n'était une fuite de données.** F5 est une panne
d'écran, F12 de la surface, F13 une demande polie aux moteurs. Le dire est
délibéré : une alerte qui exagère s'apprend à être ignorée, et l'on perd le
garde-fou sans s'en apercevoir.

---

## 2. Les quatre refus, et ce qu'ils auraient coûté

| | Pourquoi c'est refusé |
|---|---|
| **F4** | le nom du PDF est **engendré par le serveur** (`devis-${numero}.pdf`) : rien ne vient de l'utilisateur, donc rien à échapper |
| **F6** | `run-migrations.ts` suit les migrations **par nom de fichier**, enregistré dans `_migrations`. Renommer une migration « pour lever un doublon » la ferait **rejouer sur toutes les bases** — précisément le défaut qu'on prétendait corriger |
| **F7** | export et effacement d'un client existent sans écran. C'est une **décision produit / RGPD** : qui peut effacer, avec quelle preuve, et que devient une facture émise. Aucune interface n'a été construite |
| **F10** | `unsafe-inline` est bien là, et c'est réel. Le retirer sans mécanisme de `nonce` **casse l'application**. Lot à soi |

---

## 3. Trois enseignements, tirés d'erreurs commises dans ce lot

### 3.1 La revue hostile a corrigé mon propre correctif — F9

Deux compteurs avaient été posés : par jeton, et par source. Or sans
`ATLAS_PROXY_SAUTS` posé, `sourceDuVisiteur` rend **délibérément** une valeur
commune — rien ne permet de savoir qui a écrit `x-forwarded-for`. Tous les
clients partageaient donc un seul seau.

**Soixante appels depuis n'importe où, et plus aucun client de plus aucun
artisan ne peut signer son devis pendant une minute.** Le seuil devenait une
arme retournée : une dépense de calcul échangée contre un blocage commercial.

Corrigé avant toute livraison : le seuil par source **ne s'applique que si la
source est établie**. Celui par jeton, qui ne borne qu'un lien, s'applique
toujours.

### 3.2 Trois contrôles verts sur le défaut qu'ils portaient dans leur nom

Le contrôle structurel de F8 a passé trois fois avec la garde retirée :

| Ce qu'il regardait | Pourquoi il passait |
|---|---|
| le nom de la garde n'importe où dans le fichier | la ligne `import { estProprietaire }` suffisait |
| le fichier, commentaires compris | le commentaire qui **explique** la garde cite son nom |
| la ligne entière, pour trouver une lecture | `const [etat, etatApple, params] = await Promise.all(` contient le mot `params` |

Il blanchit désormais les commentaires, ne lit que le corps de la fonction, et
ne compare que **ce qui suit `await`**.

Et le contrôle hostile de F2 a rougi **sur du code juste** : la réponse refusée
porte bien des `Set-Cookie` — ceux d'Auth.js, qui rafraîchit la session dans la
couche au-dessus, valeurs pleines et expiration future. Rafraîchir n'est pas
déconnecter. Il ne compte donc plus les `Set-Cookie`, il cherche les
**effacements**.

### 3.3 `adressesAutorisees()` mentait depuis sa naissance

Son commentaire promettait que *« la liste des rubriques est l'unique source, et
une rubrique retirée ferme son adresse au même instant »*. **Aucune page ne l'a
jamais appelée** : ses seuls appelants sont des contrôles. C'est ce qui explique
le trou de F8 — la prose laissait croire à une garde centrale qui n'existait pas.

Elle **n'a pas été branchée** pour autant : un `layout` déduit du sommaire
fermerait `/reglages/prix/mesures` et `/reglages/vocabulaire`, qui n'y figurent
pas. Ce qui tient à la place, c'est une garde par page **plus** le contrôle
structurel qui refuse qu'on en oublie une.

---

## 4. Une mesure qui a surpris

Sans son exclusion du `matcher`, **`GET /robots.txt` rend 307**. Le middleware
renvoie à `/login` tout ce qui n'est pas explicitement écarté : un moteur aurait
reçu une redirection au lieu de la consigne. Le fichier aurait existé, et
n'aurait servi à rien — un garde-fou qu'on croit en place.

---

## 5. Batterie finale — le tour de clôture

Jouée sur l'état exact à fusionner (`a798770`, arbre propre). PostgreSQL et
Redis étaient tombés : remontés avant de lancer.

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ 0 erreur, 12 avertissements préexistants |
| Construction | ✅ compilée, 21/21 pages statiques |
| `npm run verifier:memoire` | ✅ 8 fichiers |
| Suites base — RLS comprises | ✅ **232 / 232** |
| Suites navigateur | ❌ **108 / 111** — *voir `docs/lot-3-cloture-et-lecture-audio.md` : le tour final rend **110/110**, et le total a changé parce que deux pièces communes étaient comptées comme des suites* |
| `npm run verifier:connexion` | ✅ connexion réelle derrière une origine étrangère |
| `npm audit` | **4 modérées** |

### Les trois rouges, rejouées seules

| Suite | Rejeu isolé |
|---|---|
| `test-anneau-dictee-e2e` | ✅ verte |
| `test-arrosage-e2e` | ✅ verte — un dépassement de 45 s sous la charge |
| `test-envoi-client-e2e` | ❌ **rouge, reproductible** |

### `npm audit` — pourquoi rien n'a été exécuté

Les quatre alertes remontent toutes la même chaîne :
`drizzle-kit → @esbuild-kit/esm-loader → esbuild ≤ 0.24.2`.

`drizzle-kit` est une dépendance de **développement**, et l'avis ne vise que le
serveur de développement d'esbuild : rien de cela n'est servi en production.
`npm audit fix --force` rétrograderait `drizzle-kit` de 0.31 à **0.18** — une
cassure majeure sur l'outil qui engendre les migrations. Non exécuté.

---

## 6. Revue hostile du diff F1–F13

| | Ce qui a été vérifié | Résultat |
|---|---|---|
| **F8** | tout autre écran réservé au patron sans garde | ✅ 15 rubriques passées, plus un balayage hors réglages : aucun écran ne lit un prix ou un tarif sans garde |
| **F2** | le refus cross-site n'efface aucun cookie | ✅ mesuré : **zéro effacement**. Les `Set-Cookie` présents sont ceux d'Auth.js, qui rafraîchit la session dans la couche au-dessus |
| **F5** | politique encore fragile au contexte vide | ✅ **0** sur les 48 politiques, interrogé en base à l'instant |
| **F1** | autre accès à l'état de mise à jour pour un membre | ✅ les 12 fonctions exportées de `reglages/actions.ts` posent leur garde |
| **F9** | seuil global involontaire quand la source n'est pas fiable | ✅ aucun introduit par ce lot |
| **F12** | page `/design` oubliée en production | ✅ 12 planches couvertes, aucune maquette hors du dossier |
| **F13** | `/robots.txt` sans redirection de connexion | ✅ 200 sans session |

### Deux observations, hors périmètre, non corrigées

- **`/catalogue` n'a pas de garde de rôle.** Il ne s'atteint que depuis une
  rubrique du patron, et il ne montre **aucun prix** — seulement le vocabulaire
  de dictée. Décision produit : un salarié doit-il le voir ?
- **`cle-appareil:${source}` est un seuil global** quand la source n'est pas
  établie. Préexistant, délibéré et documenté depuis le lot Face ID — 120 par
  minute, volontairement large.

---

## 7. Régressions

**Aucune.**

`test-envoi-client-e2e` rougit parce qu'on est le **26 août**. Le mois affiché
s'ouvre au 1er ; le contrôle écarte les trois jours à venir (délai minimal) et
ne garde que les jours ouvrables. Il ne reste que le lundi 31 — les 29 et 30
sont un samedi et un dimanche. Un seul jour acceptable, et les deux contrôles
refusent de conclure, sur du code parfaitement juste.

**Prouvé, pas supposé.** `src/` et `scripts/` ont été ramenés au commit
`2f66b00` — c'est-à-dire **avant** F1 à F13 — et la suite rejouée :

```
❌ le patron ne propose jamais plus de deux dates
   pas assez de jours acceptables (1)
❌ SANS RIEN TOUCHER, la cliente peut proposer un jour
   pas assez de jours libres au calendrier (1)
```

Exactement les deux mêmes messages. Consigné dans `TODO.md` avec le remède :
faire tourner la page du mois, comme le fait déjà `troisJoursAuMoins()` dans
`test-deux-dates-calendrier-e2e.ts`. **Ne pas relâcher le seuil** — il dit une
vraie règle : jamais plus de deux dates proposées.

*Troisième fois que cette famille de défaut coûte une soirée. `main` porte
depuis le 25 août un commit nommé « Ne plus dépendre de la place qu'il reste
dans le mois courant » — il n'avait pas couvert cette suite-ci.*

---

## 8. Verdict

# F1–F13 : **CLOS**

- **F7** — classé **décision produit / RGPD**
- **F10** — classé **lot séparé** (CSP avec `nonce`)

**Une réserve, dite noir sur blanc :** la batterie n'a pas rendu un tour
entièrement vert. Le 111/111 existe — au tour précédent, sur le même code. Le
seul écart de ce tour-ci est la suite calendaire ci-dessus, dont l'indépendance
au lot a été prouvée par exécution, non par raisonnement.

---

## 9. Ce qui reste ouvert

| | Pour qui |
|---|---|
| **F7** — l'écran RGPD (export / effacement d'un client) | décision du patron |
| **F10** — le lot CSP, avec `nonce` | développement, lot à soi |
| **`/catalogue`** sans garde de rôle | décision du patron |
| **`ATLAS_PROXY_SAUTS`** à poser en production | hébergement. Sans lui, tous les seuils par source restent communs — celui de F9 se désactive plutôt que de bloquer tout le monde |
| **`test-envoi-client-e2e`** rougira à chaque fin de mois | développement, remède écrit dans `TODO.md` |
| **`ARCHITECTURE.md` porte deux fois §164 et §165** | dette d'une fusion antérieure, déjà sur `main` |
