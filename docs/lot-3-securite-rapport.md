# Atlas — Lot 3 : rapport d'étape

**Document destiné à ChatGPT.** 25 août 2026.

> **CE N'EST PAS LE RAPPORT FINAL.** Le brief demande un rapport complet A→K
> avec un verdict. **Un seul point sur sept est terminé** — M12. Le déclarer
> validé maintenant reviendrait à transformer un « à faire » en « fait », ce que
> le brief interdit lui-même au point 7.

## Où en est le lot

| | État | Preuve |
|---|---|---|
| **M12** — mise à jour du banc | **FAIT ET ÉPROUVÉ** | suite rouge sur l'ancien code, verte sur le neuf |
| **M10** — dépendances | pas commencé | `npm audit` relevé, non corrigé |
| **M9** — `password_hash` | **cartographié**, pas codé | 11 accès recensés, terrain vérifié |
| **M11** — ré-authentification | analyse de menace à faire d'abord | — |
| **F1 → F13** | pas commencé | quatre points déjà instruits (voir plus bas) |
| **Audio** | pas commencé | état constaté |
| **Sauvegardes** | rien à coder | **BLOQUANT PRODUCTION** |

---

## A — M12 : la mise à jour du banc

### État constaté (avant)

```ts
export async function mettreAJourApplicationAction(): Promise<ResultatMiseAJour> {
  await getCurrentCtx();                            // ← une session, rien de plus
  if (process.env.ATLAS_BANC_ESSAI !== "1") { … }   // ← et le profil ignoré
```

**L'audit disait vrai, et le défaut était double.**

1. **N'importe quel compte connecté** — un membre, c'est-à-dire un salarié à qui
   le patron a ouvert un accès — pouvait déclencher un `git pull` et des
   migrations sur le banc. Ce geste change ce que l'application sert.
2. **`ATLAS_PROFIL=banc` était ignoré.** Or `src/profil-banc.ts` est la seule
   fonction qui décide de ce qu'est un banc, et `.devcontainer/demarrer.sh` ne
   pose **que** cette variable-là.

### Ce que la recherche a trouvé en plus du brief

Le second défaut ne touchait pas un endroit mais **trois** :

| Fichier | Ce que ça donnait sur un banc démarré par `demarrer.sh` |
|---|---|
| `src/app/reglages/actions.ts` | le bouton refusait sans raison |
| `src/app/reglages/page.tsx` | la phrase sur la branche suivie ne s'affichait pas |
| `src/server/version-executee.ts` | « version inconnue » |

Le troisième est le plus coûteux : c'est l'écran que le patron photographie pour
répondre à *« est-ce que mes correctifs sont arrivés ? »*.

### Correction

```ts
export async function mettreAJourApplicationAction(): Promise<ResultatMiseAJour> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "mettre à jour l'application");

  if (!estBancDEssai()) { … }
```

**L'ordre des deux gardes est délibéré** : le rôle avant le banc, le banc avant
le script. C'est ce qui permet à une suite d'éprouver le refus de rôle **sans
qu'un `git pull` puisse partir pendant la batterie**.

Le bouton est aussi masqué pour un membre (`page.tsx`). **Ce masquage ne protège
rien** — la garde qui compte est dans l'action, et elle refuse même appelée
directement. Il évite seulement de proposer un geste qu'on refusera.

### Tests — et la question du brief : « rouge sur l'ancien code ? »

`scripts/test-mise-a-jour-role-db.ts`, cinq vérifications.

**Oui, démontré.** Sur la source d'avant, restaurée pour l'occasion :

```
✗ UN MEMBRE EST REFUSÉ — et c'est bien le RÔLE qui le refuse
✗ LES DEUX MARQUES DU BANC sont reconnues — plus une seule
✗ PLUS AUCUN ÉCRAN ne lit la marque du banc en direct
    Ces fichiers décident seuls de ce qu'est un banc, et ignorent donc
    ATLAS_PROFIL : src/app/reglages/actions.ts, src/app/reglages/page.tsx,
    src/server/version-executee.ts
Mise à jour du banc — 3 échec(s).
```

Sur le code corrigé : **5/5**.

**Le piège que ce contrôle devait éviter, et qui mérite d'être dit.** Le banc est
laissé *éteint* dans le cas du membre. L'ancien code refusait alors lui aussi —
mais pour le mauvais motif (« n'existe que sur le banc d'essai »). Un contrôle
qui se serait contenté de constater *un* refus aurait été **vert sur le code
défectueux**. Ce qui est exigé est le refus **de rôle**, qui n'existait pas.

**Un garde-fou en plus :** un contrôle structurel interdit désormais à tout
fichier de `src/` de lire `process.env.ATLAS_BANC_ESSAI` en direct, sauf
`profil-banc.ts` (qui décide) et `env.ts` (qui refuse une configuration
contradictoire, et doit donc voir les deux variables séparément). Sans lui, le
prochain écran recopierait la même faute.

### Risque résiduel

`exigerProprietaire` **lève** au lieu de rendre une valeur de retour. C'est la
convention du dépôt (`creerTarifAction` fait de même), mais le message d'une
exception levée par une action serveur n'atteint jamais l'écran en production
(`AGENTS.md`). Un membre qui appellerait l'action directement verrait donc une
erreur opaque. **C'est acceptable ici** : l'écran ne lui propose pas le bouton,
et la propriété de sécurité — l'action ne s'exécute pas — est tenue.

---

## B — M10 : dépendances (RELEVÉ, PAS CORRIGÉ)

### `npm audit` — AVANT, résultat exact

```
11 vulnerabilities (4 moderate, 7 high)
```

| Paquet | Nature | Direct ? | Correctif annoncé |
|---|---|---|---|
| `postcss` | lecture de fichier arbitraire via `sourceMappingURL` (3 avis) | **non** — `node_modules/next/node_modules/postcss` | `next@16.3.2` |
| `sharp` / libvips | CVE-2026-33327, 33328, 35590, 35591 | **non** — tiré par Next | `next@16.3.2` |

**Ni `sharp` ni `postcss` ne sont déclarés dans `package.json`.** Les onze
alertes viennent toutes de `next: "16.2.12"`.

### Ce qui sera fait, et ce qui ne le sera pas

- montée **manuelle** de Next vers 16.3.2 — une **mineure**, pas une majeure.
  L'avertissement *« outside the stated dependency range »* ne dit que ceci : la
  version est épinglée au patch dans `package.json` ;
- **aucun `npm audit fix --force`** ;
- **aucune migration de `next-auth`** : la 5.0.0-beta est celle qu'Atlas éprouve
  depuis le début, Face ID compris. Le brief autorise à documenter plutôt qu'à
  refondre.

### APRÈS

*Non disponible : la montée n'est pas faite.*

---

## C — M11 : le modèle de session RÉEL (constaté, rien codé)

```ts
// src/auth.ts:35
session: { strategy: "jwt" },
```

**Aucun `maxAge` n'est posé** → la valeur par défaut d'Auth.js s'applique :
**trente jours, glissants**. Le constat de l'audit tient.

### Face ID n'est PAS une 2FA — l'architecture, pas l'affirmation

| | Ce qu'Atlas fait réellement |
|---|---|
| **Ce que c'est** | un **second fournisseur `Credentials`** dans `src/auth.ts`, à côté du mot de passe |
| **Donc** | un **premier facteur alternatif** : on entre *soit* par mot de passe, *soit* par la clé de l'appareil |
| **Ce que ce n'est pas** | un second facteur — rien n'exige jamais les deux |
| **Ce qui est vérifié** | une signature WebAuthn, contre un défi posé dans un cookie `httpOnly`/`sameSite=strict`, consommé à la lecture |
| **Ce qui n'entre jamais dans Atlas** | Face ID au sens d'Apple : il déverrouille la clé sur l'appareil ; c'est la **clé** qui signe |

### Le point que le brief soulève, et qui est juste

Une date globale `derniere_preuve_at` par utilisateur **profiterait à une session
volée** : le patron se ré-authentifie sur son iPhone, et l'ordinateur volé en
bénéficie dans la seconde. **Rien ne sera codé avant d'avoir résolu ce point** —
la preuve devra être liée à la session qui l'a obtenue, pas à l'utilisateur.

`session.maxAge` **ne sera pas modifié** dans ce lot : un artisan déconnecté sur
un chantier coûte plus cher que le risque traité.

---

## D — M9 : cartographie (rien codé)

Le brief demandait de tout recenser avant de toucher. Fait — et le terrain est
plus favorable que l'audit ne le laissait croire.

### Les onze accès à `users`

| Où | Colonnes | Après un retrait du droit sur `password_hash` |
|---|---|---|
| `src/auth.ts:47` | **`select()` nu** | **à router** — la connexion |
| `src/server/repositories/compte.ts:80` | `{passwordHash}` | **à router** — vérifier l'ancien mot de passe |
| `src/server/repositories/compte.ts:101` | `UPDATE set passwordHash` | **à router** — écrire le nouveau |
| `src/server/repositories/entreprises.ts:27` | `INSERT … returning()` **nu** | **à borner** — `RETURNING` exige le droit de lecture |
| `compte.ts:32` | `{nom, email}` | intact |
| `compte.ts:136` | `{jetonsValidesDepuis}` | intact — **coupure des sessions** |
| `charte-personne.ts:27` | `{charte}` | intact |
| `editeur.ts:37` | `{email}` | intact |
| `documents-legaux.ts:169` | `{id}` | intact |
| `session-ctx.ts:114` | `{id}` | intact |
| `cles-appareil.ts:106` | `{id}` | intact |

**Un seul `SELECT *` dans tout le dépôt**, et c'est la connexion.

**Face ID ne lit jamais `password_hash`** — `cles-appareil.ts` ne touche que la
table des clés. C'est important : le durcissement ne peut pas le casser par ce
biais.

### Le terrain, vérifié en base

| Question | Réponse constatée |
|---|---|
| `pgcrypto` disponible ? | **oui**, 1.3, pas encore installée |
| `atlas_app` peut-il créer dans `public` ? | **non** (`has_schema_privilege` = `f`) |

La seconde réponse répond directement à l'exigence du brief — *« l'impossibilité
pour `atlas_app` de modifier/remplacer les objets auxquels la fonction fait
confiance »* : il n'a aucun droit de DDL, cette propriété est **déjà** tenue.

### La forme envisagée (à éprouver, rien n'est décidé)

- `REVOKE SELECT (password_hash), UPDATE (password_hash) ON users FROM atlas_app` ;
- une fonction `SECURITY DEFINER` appartenant à `atlas_owner`, `search_path`
  épinglé, références qualifiées, `REVOKE ALL … FROM PUBLIC` puis `GRANT EXECUTE`
  au seul `atlas_app`, qui **rend un identifiant, jamais un condensat** ;
- le retrait du droit d'**écriture** compte autant que celui de lecture : sans
  lui, une injection pourrait poser un condensat connu et entrer.

**`PUBLIC` reçoit `EXECUTE` par défaut sur toute fonction** — le brief a raison
de le pointer, et le `REVOKE` sera explicite.

---

## E — F1 → F13 : quatre points déjà instruits

| | État constaté | Décision |
|---|---|---|
| **F3** `/api/health/diagnostic` | la route **borne déjà** son calcul d'origines en production (`NODE_ENV === "production"` → `[]`). Reste à constater ce que le **corps** de la réponse rend | à vérifier par un contrôle, pas à supposer |
| **F6** migrations en double | **FAUX PROBLÈME.** `scripts/run-migrations.ts` suit les migrations par **nom de fichier** dans `_migrations`. Deux noms distincts sont deux migrations distinctes | **ne rien faire** — renommer serait la seule façon de casser quelque chose |
| **F10** CSP `unsafe-inline` | présent (`next.config.ts:21-22`) | **hors de ce lot** : une CSP à nonce se joue dans le `middleware`, et mal posée elle rend l'application blanche |
| **F13** `robots.txt` | **absent**, vérifié | à ajouter — trivial et sans risque |

Les neuf autres n'ont pas encore été instruits.

---

## F — Audio : état constaté, rien changé

```ts
// src/server/upload-limits.ts:46
export function verifierTypeAudio(mimeType: string) {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (!TYPES_AUDIO_AUTORISES.includes(base)) …
```

**Le type déclaré par le navigateur, et rien d'autre.** Nous l'avions déjà écrit
au Lot 2B — ce n'est pas une découverte du brief.

**Ce qui borne le risque, et que le brief ne dit pas :** depuis M1, le type
**servi** n'est plus le type déclaré — il est dérivé de l'extension de la clé,
choisie par le serveur. Ce qui reste possible est de **ranger** un fichier inerte
sous une extension audio, pas de le faire exécuter.

Le piège d'une vérification par signature est identifié : un iPhone envoie du
MP4/AAC, un navigateur Android du WebM/Opus. Une liste trop étroite ferait
refuser des dictées réelles sur un chantier.

---

## G — Sauvegardes

**BLOQUANT PRODUCTION — SAUVEGARDE/RESTAURATION NON ÉPROUVÉE.**

Aucun fournisseur d'hébergement PostgreSQL ni de stockage objet n'est déclaré
dans le dépôt. Rien ne sera écrit qui ressemble à une sauvegarde de production.

---

## H — Tests réellement exécutés

| Commande | Résultat exact |
|---|---|
| `npx tsc --noEmit` | 0 erreur |
| `npm run lint` | 0 erreur |
| `npm run verifier:memoire` | cohérente (8 fichiers) |
| `npx tsx scripts/test-mise-a-jour-role-db.ts` | **5/5** — et **3 échecs** sur la source d'avant |
| suites base (`npm test`) | **224/224** |
| suites navigateur | *batterie en cours au moment d'écrire* |
| `npm audit` | 11 alertes (relevé, non corrigé) |

---

## I — Régressions rencontrées pendant ce lot

**Aucune du fait de M12.** Pour mémoire, celles rencontrées en fermant le Lot 2B
juste avant, toutes dans les SUITES et jamais dans le produit : sept contrôles
qui attendaient un délai plutôt qu'un signal, ou une formulation plutôt qu'une
règle. Détail dans `CHANGELOG.md` du 25 août.

---

## J — Fichiers et migrations

| Fichier | Nature |
|---|---|
| `scripts/test-mise-a-jour-role-db.ts` | **créé** — 5 vérifications |
| `src/app/reglages/actions.ts` | rôle propriétaire + `estBancDEssai()` |
| `src/app/reglages/page.tsx` | bouton masqué pour un membre, `estBancDEssai()` |
| `src/server/version-executee.ts` | `estBancDEssai()` |
| `CHANGELOG.md`, `docs/lot-3-securite-lecture.md` | mémoire du dépôt |

**Aucune migration.**

---

## K — Reste à faire

1. **M10** — monter Next manuellement, batterie complète, `npm audit` après ;
2. **M9** — le vrai sujet : `REVOKE` de colonne + fonction verrouillée, avec les
   neuf tests négatifs demandés, **joués sous `atlas_app`** ;
3. **M11** — résoudre d'abord la liaison preuve ↔ session, puis la liste exacte
   des opérations sensibles, puis coder ;
4. **F1, F2, F4, F5, F7, F8, F9, F11, F12** — à instruire ; **F13** à ajouter ;
5. **Audio** — étudier la signature, ou laisser ouvert et le dire ;
6. **Sauvegardes** — rien à coder.

---

## Verdict

**LOT 3 NON VALIDÉ — parce qu'il n'est pas terminé.**

Ce n'est pas un échec : c'est l'état réel après le premier des sept points. M12
est fait, prouvé rouge sur l'ancien code, et vert sur le neuf. Le reste n'est pas
commencé, et l'annoncer autrement serait exactement ce que le brief interdit.
