# Atlas — Lot 3 : fermeture F1–F13

*25 août 2026 · branche `claude/atlas-securite-lot3`*

Ce document répond au brief F1–F13. Il fait suite à
`docs/lot-3-f1-f13-lecture.md` (l'instruction, sans code) et à
`docs/lot-3-m11-rapport.md` (la clôture de M11).

---

## 0. Rappel : le rapport d'audit n'est pas dans le dépôt

Les treize constats n'existent que dans le texte transmis. **Deux seulement
citaient un fichier** ; les onze autres ont donc été traités comme des
hypothèses à mesurer, jamais comme des constats acquis.

C'est ce qui a permis d'en écarter quatre sans rien casser — et l'un d'eux, F6,
aurait fait rejouer partout une migration déjà passée s'il avait été « corrigé ».

---

## 1. Ce qui a été fait, point par point

| | Verdict | Ce qui a changé | Le contrôle, et son état |
|---|---|---|---|
| **F1** | fondé | `derniereIssueMiseAJour` exige le propriétaire | `test-mise-a-jour-role-db.ts` — **2 contrôles neufs**, vus rouges |
| **F2** | fondé | `/api/session-perimee` refuse `Sec-Fetch-Site: cross-site` | `test-session-perimee-e2e.ts` — 7 → **8**, vu rouge |
| **F3** | partiellement fondé | **rien** (consigne tenue) | `test-diagnostic-sans-secret.ts` — **5 contrôles neufs**, vert d'emblée, vu rouge contre une variable ajoutée |
| **F4** | faux problème | rien | — |
| **F5** | fondé | migration **0067**, additive | `test-isolation-contexte-vide-db.ts` — **4 contrôles neufs**, vus rouges |
| **F6** | faux problème | rien — **et surtout aucun renommage** | — |
| **F7** | décision produit | rien | — |
| **F8** | fondé | garde de rôle sur `/reglages/agenda` | `test-reglages-gardes.ts` — **4 contrôles neufs**, vus rouges |
| **F9** | fondé | cadence sur la réponse publique au devis | `test-devis-client-e2e.ts` — 11 → **12**, vu rouge |
| **F10** | réel, hors lot | rien | — |
| **F11** | déjà fermé (lot 1) | rien | contrôle existant |
| **F12** | fondé | `src/app/design/layout.tsx` | `test-maquettes-hors-production.ts` — **4 contrôles neufs**, vus rouges |
| **F13** | fondé | `src/app/robots.ts` + `matcher` | `test-pages-publiques-…-e2e.ts` — 6 → **7**, vu rouge |

**Aucun de ces sept n'était une fuite de données.** F5 est une panne d'écran,
F12 de la surface, F13 une demande polie aux moteurs. Le dire est un choix : une
alerte qui exagère s'apprend à être ignorée, et l'on perd le garde-fou sans s'en
apercevoir.

---

## 2. Les quatre refus, et ce qu'ils auraient coûté

| | Pourquoi c'est refusé |
|---|---|
| **F4** | le nom du fichier de devis est **engendré par le serveur** (`devis-${numero}.pdf`). Il n'y a rien qui vienne de l'utilisateur, donc rien à échapper |
| **F6** | `run-migrations.ts` suit les migrations **par leur nom de fichier**, enregistré dans `_migrations`. Renommer une migration « pour lever un doublon » la ferait **rejouer sur toutes les bases** — c'est exactement le défaut qu'on prétendait corriger |
| **F7** | l'export et l'effacement d'un client existent sans écran. C'est une **décision produit / RGPD** : qui peut effacer, avec quelle preuve, et que devient une facture émise. Aucune interface n'a été construite |
| **F10** | `unsafe-inline` est bien là, et c'est réel. Le retirer sans mécanisme de `nonce` **casse l'application**. Lot à soi |

---

## 3. Les trois choses que ce lot a apprises en se trompant

### 3.1 La revue hostile a corrigé mon propre correctif — F9

F9 posait deux compteurs : par jeton, et par source. Or sans `ATLAS_PROXY_SAUTS`
posé, `sourceDuVisiteur` rend **délibérément** une valeur commune — rien ne
permet de savoir qui a écrit `x-forwarded-for`. Tous les clients partageaient
donc un seul seau.

**Soixante appels depuis n'importe où, et plus aucun client de plus aucun
artisan ne peut signer son devis pendant une minute.** Le seuil devenait une
arme retournée : une dépense de calcul échangée contre un blocage commercial.

Corrigé avant toute livraison : le seuil par source **ne s'applique que si la
source est établie**. Celui par jeton, qui ne borne qu'un lien, s'applique
toujours.

### 3.2 Trois contrôles verts sur le défaut qu'ils portaient dans leur nom

Le contrôle structurel de F8 a été **vert deux fois** avec la garde retirée :

| Ce qu'il regardait | Pourquoi il passait |
|---|---|
| le nom de la garde n'importe où dans le fichier | la ligne `import { estProprietaire }` suffisait |
| le fichier, commentaires compris | le commentaire qui EXPLIQUE la garde cite son nom |
| la ligne entière, pour trouver une lecture | `const [etat, etatApple, params] = await Promise.all(` contient le mot `params` |

Et le contrôle hostile de F2 a rougi **sur du code juste** : la réponse refusée
porte bien des `Set-Cookie` — ceux d'Auth.js, qui rafraîchit la session dans la
couche au-dessus. Rafraîchir n'est pas déconnecter. Il ne compte plus les
`Set-Cookie`, il cherche les **effacements**.

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
renvoie à `/login` tout ce qui n'est pas explicitement laissé de côté : un moteur
aurait reçu une redirection au lieu de la consigne. Le fichier aurait existé,
et n'aurait servi à rien — un garde-fou qu'on croit en place.

---

## 5. Ce qui reste ouvert

| | Pour qui |
|---|---|
| **F7** — l'écran RGPD (export / effacement d'un client) | décision du patron |
| **F10** — le lot CSP, avec `nonce` | développement, lot à soi |
| **`ATLAS_PROXY_SAUTS`** à poser en production | hébergement. Sans lui, tous les seuils par source restent communs — dont, désormais, celui de F9, qui se désactive plutôt que de bloquer tout le monde |
| **`ARCHITECTURE.md` porte deux fois §164 et §165** | dette d'une fusion antérieure, déjà sur `main`. Non corrigé ici : les références croisées pointent vers les deux sens, et les démêler dépasse ce lot |
