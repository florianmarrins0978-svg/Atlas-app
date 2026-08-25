# Atlas — Lot 3 : rapport d'étape n° 2

**Document destiné à ChatGPT.** 25 août 2026.

> **CE N'EST PAS LE RAPPORT FINAL.** M12, M10 et M9 sont clos et éprouvés. M11
> est **à moitié fait** : la partie la plus dure — l'identité de session — est
> posée et prouvée, la preuve récente ne l'est pas encore. F1–F13, l'audio et les
> sauvegardes ne sont pas commencés.

## Où en est le lot

| | État |
|---|---|
| **M12** — mise à jour du banc | **CLOS**, batterie verte |
| **M10** — dépendances | **CLOS**, batterie verte |
| **M9** — `password_hash` | **CLOS**, batterie verte |
| **VULNÉRABILITÉ HORS LOT** — coupure contournable | **TROUVÉE, REPRODUITE, FERMÉE** |
| **M11** — ré-authentification | **A et B faits** ; C partiellement ; D→G à faire |
| F1 → F13 | 4 instruits sur 13 |
| Audio | constaté, rien changé |
| Sauvegardes | **BLOQUANT PRODUCTION** |

---

## A — M12 : la mise à jour du banc

### Avant

```ts
export async function mettreAJourApplicationAction(): Promise<ResultatMiseAJour> {
  await getCurrentCtx();                            // ← une session, rien de plus
  if (process.env.ATLAS_BANC_ESSAI !== "1") { … }   // ← et le profil ignoré
```

**Deux défauts, pas un.** N'importe quel compte connecté — un salarié — pouvait
tirer du code et jouer des migrations sur le banc du patron. Et `ATLAS_PROFIL=banc`
était ignoré, alors que `.devcontainer/demarrer.sh` ne pose **que** celui-là.

### Ce que la recherche a ajouté au brief

Le second défaut touchait **trois** fichiers, pas un — dont
`src/server/version-executee.ts`, c'est-à-dire l'écran que le patron
photographie pour répondre à *« mes correctifs sont-ils arrivés ? »*.

### Correction et preuve

`exigerProprietaire()` **avant** `estBancDEssai()` — cet ordre permet d'éprouver
le refus de rôle sans qu'un `git pull` puisse partir. Le bouton est masqué en
plus, jamais à la place.

`scripts/test-mise-a-jour-role-db.ts` — **5/5**. Sur la source d'avant,
restaurée : **3 échecs**, nommant les trois fichiers coupables.

Un contrôle structurel interdit désormais toute lecture directe de
`process.env.ATLAS_BANC_ESSAI` hors des deux fichiers qui en ont le droit.

---

## B — M10 : dépendances

| | AVANT | APRÈS |
|---|---|---|
| `npm audit` | **11** (4 modérées, 7 hautes) | **4** (4 modérées) |

**Fermé :** `postcss` (3 avis, lecture de fichier arbitraire par
`sourceMappingURL`) et `sharp`/libvips (4 CVE). **Ce sont les seules qui
traitaient une entrée d'utilisateur** — une image téléversée, une feuille de
style construite.

**Comment :** montée **manuelle** `next` 16.2.12 → **16.3.2**, plus
`eslint-config-next`. Une **mineure**. L'avertissement d'npm — *« outside the
stated dependency range »* — ne disait qu'une chose : la version était épinglée
au patch. **Aucun `npm audit fix --force`.** `package.json` n'a bougé que de deux
lignes.

**Ce qui reste, et pourquoi je refuse de le fermer :** `esbuild` via
`drizzle-kit`, **développement seul**. Le correctif imposerait un retour
0.31 → **0.18** sur l'outil qui écrit les migrations. Le remède serait pire que
le mal.

**`next-auth` n'a pas bougé, et pas seulement parce qu'il est en bêta :** il
n'existe **aucune version stable de la v5** — la marque `latest` pointe encore
sur `4.24.15`, la ligne incompatible. Question tranchée par le registre, pas par
une opinion.

---

## C — M9 : le condensat hors de portée

### La propriété tenue

> `atlas_app` ne peut plus lire `users.password_hash` — même en SQL direct — mais
> peut demander à la base de vérifier **un** mot de passe sans jamais en recevoir
> le condensat.

`drizzle/0064_secret_authentification.sql` : trois fonctions `SECURITY DEFINER`
appartenant à `atlas_owner`, `search_path` épinglé, tout qualifié, `EXECUTE`
retiré à `PUBLIC` puis accordé au seul `atlas_app`. **Aucune signature ne peut
rendre un condensat** — elles rendent un `uuid` ou un `boolean`, et la suite le
vérifie sur `pg_proc`, pas sur leur commentaire.

**Pas de RLS par entreprise sur `users`**, et ce n'est pas un renoncement : un
utilisateur n'est rattaché à une entreprise qu'**après** s'être identifié.

### Le piège qui a failli tout fermer — mesuré, pas supposé

`pgcrypto` ne relit que les condensats préfixés `$2a$` ; `bcryptjs` écrit `$2b$`.
**La première version rendait faux sur le BON mot de passe** : la porte fermée
pour tout le monde.

Les deux moteurs ont été comparés sur six cas, **au positif et au négatif** :

| Cas | pgcrypto | bcryptjs |
|---|---|---|
| court, accents, emoji | accepte le bon, refuse le mauvais | identique |
| 255, 256, 300 octets | accepte le bon, **accepte aussi un mauvais** | **identique** |

La seconde ligne n'est pas une faiblesse de `pgcrypto` : **bcrypt tronque à 72
octets**, et `bcryptjs` fait exactement pareil aujourd'hui. Rien de ce qui était
accepté ne change. *(Cette troncature est une faiblesse ancienne d'Atlas, notée
dans `TODO.md` — la corriger invaliderait tous les mots de passe.)*

### Tests — 17/17 sous `atlas_app`, 7 rouges sur les anciens droits

Refusés : `SELECT` global, condensat ciblé, sous-requête, agrégat, `ORDER BY`,
`SELECT *`, `COPY`, et l'**écriture**. Intacts : connexion, mauvais mot de passe,
adresse inconnue, changement de mot de passe, ancien devenu inopérant, Face ID,
coupure des sessions.

### Deux régressions rencontrées, et ce qu'elles apprennent

| | |
|---|---|
| borner `INSERT` par colonne | Drizzle **nomme** `password_hash` dans chaque insertion, même avec `default`, et PostgreSQL exige le droit sur toute colonne **citée**. **48 suites rouges** d'un coup |
| `returning()` nu | `RETURNING` exige de lire les colonnes rendues |

**Risque résiduel assumé :** `INSERT` reste au niveau table. Une injection
pourrait donc **créer** un compte avec un condensat connu — mais ce compte
n'appartient à aucune entreprise, et `getCurrentCtx` refuse un utilisateur sans
adhésion. Le danger réel était de **changer** le condensat d'un compte existant :
c'est `UPDATE`, et il est retiré.

---

## D — LA VULNÉRABILITÉ TROUVÉE PENDANT M11 (ce n'est PAS M11)

### Constat

> **« Me déconnecter partout » se contournait.**

`GET /api/auth/session` est une route publique d'Auth.js. Elle décode le cookie,
rejoue les rappels et **repose un cookie neuf** — sans jamais consulter la
coupure. Or `@auth/core` fait, à chaque réémission :

```js
.setIssuedAt()                    // ← iat remis à maintenant
.setJti(crypto.randomUUID())      // ← jti neuf
```

…et c'est `iat` que la coupure comparait. Un cookie volé, pourtant coupé, se
redonnait donc un `iat` postérieur à la coupure et **rentrait**.

### Reproduit dans un vrai navigateur

```
  ✓ connecté
  → /api/auth/session a répondu 200 (sans avoir visité d'écran)
  ✗✗ LA COUPURE SE CONTOURNE : la session refusée est revenue.
```

### La faute de méthode, à écrire noir sur blanc

**Ma première sonde a annoncé « la coupure tient ».** Elle visitait un écran
protégé avant d'essayer le contournement — or cet écran renvoie vers la route qui
**efface le cookie**. Elle mesurait un navigateur déjà vidé, **sans avoir joué
l'attaque**. Un attaquant ne visite aucun écran.

*C'est le contrôle qui mesure zéro (`CLAUDE.md` §5), dans une robe neuve : le
premier verdict était vert et ne prouvait rien.*

### Correction — centrale, pas propre à une route

Le brief demandait de ne pas rustiner `/api/auth/session` seule. **Je n'ai touché
ni la route ni le *middleware*** : aucun des deux ne peut lire la base, et c'est
délibéré.

À la place, le jeton porte deux marques posées par Atlas :

| `sessionId` | l'identité — la preuve de M11 s'y accroche |
| `authentifieLe` | l'ancienneté — **c'est elle que la coupure compare** |

Les deux sont posées **une seule fois**, à une vraie authentification, et
recopiées à l'identique aux réémissions. **Réémettre ne rajeunit plus rien**,
quel que soit le chemin Auth.js emprunté.

**Où la propriété vit :** `getCurrentCtx`. Les 20 routes de `src/app/api` ont été
auditées — **tout chemin qui sert ou écrit une donnée métier y passe**. Les
seules qui ne l'appellent pas sont Auth.js lui-même, le cron (secret dédié), les
routes de santé, les polices, et la route qui efface les cookies.

**Pas de boucle** : `getCurrentCtx` lit la session, puis la base, puis compare.

### Preuves

- `scripts/test-coupure-sessions-e2e.ts` — le parcours de l'attaquant, **vu rouge
  sur le code d'avant**, vert maintenant ;
- `scripts/test-identite-session.ts` — **13/13**, sans base ni navigateur : deux
  connexions donnent deux identités, dix réémissions n'usent rien, et une session
  volée reste coupée après dix réémissions.

### Le repli, et pourquoi il est délibéré

Un jeton signé avant cette version ne porte pas `authentifieLe` : il retombe sur
son `iat`. **Le refuser d'office déconnecterait tout le monde au déploiement** —
un geste que personne n'a demandé. Le repli s'éteint seul quand les anciens
jetons expirent.

---

## E — M11 : ce qui est fait, ce qui ne l'est pas

### Fait, et prouvé

L'identité stable de session (ci-dessus). C'était le verrou : sans elle, une
preuve récente n'aurait pas su à quelle session appartenir.

### Constaté, et qui contredit trois hypothèses du brief

| Hypothèse | Ce que dit le code |
|---|---|
| « changement de rôle » | **n'existe pas** dans Atlas |
| « changement de mot de passe à protéger » | **déjà une preuve récente** — il exige le mot de passe actuel, vérifié en base depuis M9 |
| « `exporterClient` / `effacerClient` » | **aucun écran ne les appelle** (confirme F7) |

### Ce que « me déconnecter partout » révoque, exactement

| Révoque | **les sessions** — toutes celles authentifiées avant la coupure |
| Ne révoque PAS | **les clés Face ID.** Elles peuvent produire une NOUVELLE session après la coupure, et c'est voulu |

**Une correction à faire, et elle n'était dans aucun brief :** l'écran laisse
aujourd'hui croire que ce bouton sécurise un compte compromis. Il ne le fait pas.
Un libellé qui promet plus qu'il ne tient est un mensonge, pas une nuance — je le
rectifierai avec M11.

### Reste à faire

Preuve récente de **10 minutes**, liée au `sessionId`, pour quatre gestes :
IBAN, ajout d'une clé, suppression d'une clé, export complet. Plus l'isolation
entre deux sessions du même utilisateur.

---

## F — F1 → F13 : 4 instruits sur 13

| | Constat | Décision |
|---|---|---|
| **F3** `/api/health/diagnostic` | borne déjà son calcul d'origines en production | vérifier le **corps** de la réponse par un contrôle |
| **F6** migrations en double | **FAUX PROBLÈME** — le lanceur les suit par nom de fichier | **ne rien faire** ; renommer serait la seule façon de casser |
| **F7** `exporterClient` / `effacerClient` | **confirmé** : aucun appelant | décision produit, pas de sécurité |
| **F10** CSP `unsafe-inline` | présent | **hors lot** — une CSP à nonce mal posée rend l'application blanche |
| **F13** `robots.txt` | **absent** | à ajouter, trivial |

---

## G — Audio

`verifierTypeAudio` ne regarde que **le type déclaré** — inchangé.

**Ce qui borne le risque, et que le brief ne dit pas :** depuis M1, le type
**servi** est dérivé de l'extension de la clé, choisie par le serveur. Ce qui
reste possible est de **ranger** un fichier inerte sous une extension audio, pas
de le faire exécuter.

---

## H — Sauvegardes

**BLOQUANT PRODUCTION — SAUVEGARDE/RESTAURATION NON ÉPROUVÉE.**

Aucun fournisseur n'est déclaré dans le dépôt. **NON VÉRIFIABLE DEPUIS LE DÉPÔT.**

---

## I — Régressions rencontrées pendant ce lot

| | Rattrapée par |
|---|---|
| `INSERT` borné par colonne → 48 suites rouges | la batterie |
| `returning()` nu → 3 suites rouges | la batterie |
| une sonde qui annonçait « la coupure tient » sans jouer l'attaque | la relecture de son propre ordre de gestes |
| `require()` dans une suite, devenu erreur avec le lint de Next 16.3 | le lint |

---

## J — Fichiers et migrations

**Migration :** `drizzle/0064_secret_authentification.sql` (la seule).

**Créés :** `src/server/secret-authentification.ts`, `src/lib/identite-session.ts`,
`scripts/test-mise-a-jour-role-db.ts`, `scripts/test-secret-authentification-db.ts`,
`scripts/test-identite-session.ts`, `scripts/test-coupure-sessions-e2e.ts`,
`scripts/sonde-jeton-session.mts`.

**Modifiés :** `src/auth.ts`, `src/auth.config.ts`, `src/server/session-ctx.ts`,
`src/types/next-auth.d.ts`, `src/app/reglages/actions.ts`,
`src/app/reglages/page.tsx`, `src/server/version-executee.ts`,
`src/server/repositories/compte.ts`, `src/server/repositories/entreprises.ts`,
`package.json`, plus trois suites adaptées.

---

## K — Reste à faire

1. **M11** — la preuve récente de 10 minutes et les quatre gestes ;
2. le **libellé** de « me déconnecter partout », qui promet trop ;
3. **F1, F2, F4, F5, F8, F9, F11, F12** à instruire ; **F13** à ajouter ;
4. **Audio** — signature légère, ou point laissé ouvert et dit comme tel ;
5. **Sauvegardes** — rien à coder tant que l'hébergement n'est pas choisi.

---

## Verdict

**LOT 3 PARTIELLEMENT VALIDÉ.**

Trois points sur sept sont clos et éprouvés, plus une vulnérabilité hors
périmètre trouvée, reproduite et fermée. M11 a franchi son verrou. Le reste n'est
pas commencé, et l'annoncer autrement serait transformer un « à faire » en
« fait ».
