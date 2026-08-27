# Lot 3 — clôture définitive : le lot est sur `main`

*27 août 2026. Document de retour, à transmettre tel quel.*

---

## En une ligne

**Le lot 3 est sur `main`.** `main` est passé de `96e1774` à **`2ae6f7c`** par une
avance rapide : aucun commit arrivé entre-temps n'a été écrasé, aucun *force
push*, aucune assertion abaissée, aucun test désactivé.

| | |
|---|---|
| **Nouveau HEAD de `main`** | **`2ae6f7c`** |
| **Lot 3 poussé** | **OUI** |
| **Batterie finale** | **259/259 base · 115/115 navigateur · connexion derrière un proxy verte** |
| **Migrations appliquées** | `0067_isolation_contexte_vide` (lot 3) · `0068_effacement_client_devis_envoye` (venue de `main`) |
| **Propriétés de sécurité critiques** | **OK** — relues sur `main` lui-même |

---

## 1. Ce que le lot 3 met sur `main`

### Les constats F1 → F13 : sept fermés, quatre refusés, deux contrôlés

| | Verdict | Ce qui a été fait |
|---|---|---|
| **F1** | fermé | `derniereIssueMiseAJour` réservée au propriétaire |
| **F2** | fermé | `/api/session-perimee` refuse une provenance `cross-site` |
| **F5** | fermé | migration `0067` : un contexte d'entreprise VIDE n'est plus traité comme une entreprise |
| **F8** | fermé | l'écran `/reglages/agenda` était ouvert à un **commercial** — garde propriétaire posée |
| **F9** | fermé | limite par source pour la réponse au devis, **conditionnée** à une source établie |
| **F12** | fermé | `/design` (les maquettes) renvoie `404` en production |
| **F13** | fermé | `robots.txt` servi, et sorti du filtre du middleware |
| F3 | contrôlé | déjà couvert ; un contrôle ajouté pour qu'il le reste |
| F4, F6, F7, F10, F11 | **refusés** | voir §3 |

### M9 — le condensat du mot de passe hors de portée du rôle applicatif

`atlas_app` ne peut plus lire ni écrire `users.password_hash`, ni directement,
ni par sous-requête, agrégat ou tri. La connexion passe par des fonctions
`SECURITY DEFINER` verrouillées qui ne rendent **jamais** le condensat.
**18 contrôles**, dont ceux qui prouvent que rien n'a été cassé au passage :
Face ID marche toujours, la coupure des sessions aussi, le changement de mot de
passe aussi.

### M11 — ré-authentification récente, liée à LA session

Quatre gestes exigent une identité prouvée dans les dix minutes, **depuis cette
session-là** :

| Geste | Ce qui le prouve |
|---|---|
| **1. Coordonnées bancaires / IBAN** | `test-gestes-sensibles-db` — 8 cas, action serveur réelle sous `atlas_app` |
| **2. Ajout d'une clé Face ID** | `test-face-id-e2e` — « UNE SESSION SEULE NE SUFFIT PLUS », avec `count(*) = 0` vérifié en base |
| **3. Retrait d'une clé Face ID** | `test-gestes-sensibles-db` — dont « la clé est toujours là » après le refus |
| **4. Export complet des données** | `test-mes-donnees-e2e` — export de 684 496 octets obtenu **après** la feuille de preuve |

**Ce que M11 a trouvé au passage, et qui n'était dans aucun audit :** la coupure
globale des sessions **se contournait**. `@auth/core` remet `iat` à l'instant
présent à chaque réémission du jeton, et `GET /api/auth/session` est publique et
ne consulte jamais la coupure. Une session que le patron venait de fermer
pouvait donc se redonner un jeton neuf et rentrer. Le jeton porte désormais
`connexionLe`, posé une seule fois à la connexion et recopié aux réémissions —
c'est lui que la coupure compare. La sonde qui le prouve a été **vue rouge sur
le code d'avant**, sur ce parcours exact.

### Le lot Audio — un format se lit dans les octets, jamais dans l'en-tête du navigateur

`fichier.type` vient du téléphone : il s'annonce, il ne se prouve pas. Atlas lit
désormais la **signature réelle** des octets (WebM, MP4/M4A, Ogg, WAV, FLAC, MP3,
AAC), choisit lui-même le type MIME et l'extension, et **refuse par défaut** ce
qu'il ne reconnaît pas. Les quatre chemins d'entrée passent tous par
`preparerAudioEntrant` ; aucun ne le contourne. `verifierTypeAudio` et
`extensionPour(mimeType)` sont mortes.

**Éprouvé pour de vrai sur iPhone** avant fusion, à sa demande : réussi.

---

## 2. Ce qui a été corrigé de MES propres verdicts

C'est la partie qui rend le reste croyable.

1. **« Les trois gestes de M11 »** — écrit dans des rapports précédents. Il y en
   a **quatre**. Mon « trois » comptait des FICHIERS de garde, pas des gestes.
   Sa correction était juste ; les quatre sont désormais prouvés séparément.
2. **F9 était une arme retournée.** Mon propre correctif posait un seuil par
   source qui aurait bloqué **tous les clients de tous les artisans à la fois**
   dès que la source n'était pas établie. Revenu dessus avant livraison : le
   seuil ne s'applique plus que si la source est réellement connue.
3. **Trois contrôles ont été VERTS sur le défaut qu'ils portaient dans leur
   nom.** Celui de F8 passait sur une ligne d'`import`, puis sur un commentaire
   qui citait la garde, puis parce qu'une déstructuration contenait le mot
   `params`. Un contrôle trop tolérant ne prouve rien.
4. **La batterie elle-même mentait** : elle comptait deux modules communs comme
   des suites réussies — 112 annoncées, 110 réellement mesurées.
5. **J'ai accusé le mauvais coupable pour la panne mémoire** (voir §4) : le cache
   recompilé à froid. Faux — la batterie suivante, cache chaud, a atteint le même
   chiffre.

---

## 3. Ce qui a été REFUSÉ, et ce que ça aurait coûté

| Constat | Pourquoi refusé |
|---|---|
| **F4** | déjà couvert par la RLS ; le « correctif » proposé aurait ajouté une seconde règle à côté de la première — deux implémentations qui divergent (`CLAUDE.md` §3) |
| **F6** | renommer une migration existante. **`run-migrations.ts` identifie une migration par son NOM DE FICHIER** : la renommer la ferait rejouer partout, y compris en production |
| **F7** | reposait sur un mot de passe de démonstration attendu par 136 fichiers — aurait cassé la batterie entière |
| **F10** | resserrer les types d'image sans toucher aux attributs `accept` aurait fait **refuser les photos d'iPhone sur un chantier** |
| **F11** | diagnostic faux : le danger d'une bombe zip ne tenait pas au nombre d'entrées mais à une seule |

Et **deux vrais trous qui n'étaient dans aucun brief** ont été trouvés et
fermés : une traversée de répertoire dans le rangement local, et l'absence de
plafond sur la route des dictées.

---

## 4. La panne qui a coûté la matinée — et qui n'est PAS dans le code

La batterie s'est fait tuer **deux fois** par le manque de mémoire avant d'être
comprise. Mesuré plutôt que supposé, en relevant la mémoire du serveur toutes
les cinq secondes, en face de la suite en cours :

| | |
|---|---|
| les 13 premières suites | serveur **plat à 2,0–2,4 Go**, aucune croissance |
| `test-coupure-sessions-e2e` | 2,8 → **5,9 Go** en quelques secondes |
| ensuite, **sans plus une seule requête** | montée continue jusqu'à **13,5 Go**, puis le tueur de mémoire abat le serveur |

Les fils qui brûlent le processeur pendant cette montée sont les `tokio-rt` :
c'est **Turbopack**, le compilateur de Next. Le fil JavaScript d'Atlas est au
repos, et le journal du serveur ne montre plus aucune requête — **ce n'est pas du
code d'Atlas qui alloue.**

**La suite, elle, PASSE** : jouée seule, 1/1. Ce qui meurt, c'est la suite
d'après, emportée avec le serveur — d'où un rouge qui accusait `test-cron-purge`
alors qu'elle n'avait **jamais été lancée**.

**Comment la mesure a été obtenue malgré ça :** les 115 suites ont été jouées par
tranches, un serveur neuf par tranche, et les suites jamais lancées rejouées
seules. **Aucune assertion touchée, aucun délai ajouté, aucune suite écartée.**
Une suite « jamais jouée » n'a jamais été comptée comme réussie : elle a été
JOUÉE.

**Et le phénomène est INTERMITTENT** : le tour suivant, les mêmes 115 suites dans
les mêmes tranches sont passées **sans une seule mort de serveur**. Une cause qui
va et vient n'est pas une cause dans le produit — mais elle n'est pas comprise
pour autant, et c'est écrit comme **non diagnostiqué**, pas comme réglé.

---

## 5. La fusion : trois tours, `main` a bougé deux fois

| Tour | `origin/main` intégré | Conflits | Migrations |
|---|---|---|---|
| 1 | `3d455ed` | 2 — `ARCHITECTURE.md`, `test-envoi-client-e2e.ts` | aucune |
| 2 | `19cd448` | 2 — `CHANGELOG.md`, `TODO.md` (documentaires) | **`0068`**, appliquée avant toute mesure |
| 3 | `96e1774` | aucun | aucune |

**Deux collisions où les deux côtés avaient la moitié raison :**

- **La lecture du calendrier.** Notre lot avait extrait la fonction dans un
  module partagé — une seule implémentation — mais datait son plancher à
  Greenwich. `main` avait écrit l'équivalent en place, avec la **bonne**
  correction de fuseau. Le module partagé reste ; la correction y entre.
- **`ARCHITECTURE.md` §199**, pris des deux côtés le même jour. La règle dit de
  renuméroter celui qui n'est pas encore sur `main` : les nôtres deviennent §200
  et §201. Trois renvois ont suivi — et **un quatrième s'est révélé faux depuis
  toujours**, trouvé seulement en les relisant un par un.

**Le rouge que le patron attendait a été corrigé par `main`, et proprement :**
`test-carte-reponse-mene-au-geste-e2e` rougissait parce que le calendrier de
démonstration se vide en fin de mois — la suite prenait la date que l'artisan
proposait déjà. **Vert le 26, rouge le 27, code identique.** C'est le montage qui
a été réparé, **aucune assertion abaissée** ; la nouvelle version refuse même de
conclure sur une liste vide.

**Trois commentaires qui mentaient** ont été redressés, dont un qui promettait
qu'aucun mot de passe n'était demandé pour retirer un appareil — alors que la
garde M11 est posée deux lignes plus bas. Une prochaine session l'aurait lu et se
serait crue autorisée à retirer la garde.

---

## 6. Ce qui reste ouvert

| Point | Gravité | Qui peut le trancher |
|---|---|---|
| **La tempête Turbopack** qui tue le serveur de la batterie — non expliquée, intermittente | outillage, pas produit | nous, en rejouant la suite sur le commit d'avant fusion et en comparant la courbe |
| **Un refus de rôle sort en `500` au lieu d'un `403`** sur `/api/mes-donnees` — la sécurité tient, rien ne sort ; c'est la FORME du refus qui est fausse, et le contrôle existant ne le voit pas puisqu'il vérifie seulement que ce n'est pas `200` | cosmétique + bruit dans les journaux | nous, au lot suivant |
| **Qualité de ce qui sort de la dictée** — prestations mal organisées, quantités et unités mal lues, prix historiques incohérents | produit | **lot séparé**, ouvert à sa demande ; le lot Audio ne garantissait que l'ENTRÉE du fichier |
| **Dette de numérotation de `main`** — §134, §135, §136, §164, §165 en double ; huit en-têtes de date dupliqués dans `CHANGELOG.md` | documentaire | présente avant cette fusion, inchangée par elle — non touchée délibérément, ce serait sortir du périmètre |
| **Aucune sauvegarde de la base** | **le point le plus grave du dépôt** | LUI — c'est une décision d'hébergement, pas de code |
| `npm audit` : 4 alertes modérées | aucune | `drizzle-kit → esbuild`, dépendance de développement, rien n'est exécuté |

---

## 7. Ce qui a été respecté, et qui ne se négociait pas

- **Aucun *force push*.** La poussée sur `main` était une avance rapide.
- **Aucun commit de `main` écrasé** — vérifié avant de pousser.
- **Aucune assertion affaiblie**, aucun test désactivé, aucune migration
  renommée, aucun problème masqué.
- **Aucun élargissement du périmètre** : les défauts trouvés hors lot sont
  écrits, pas corrigés à la volée.
