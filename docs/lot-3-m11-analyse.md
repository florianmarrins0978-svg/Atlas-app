# M11 — Ré-authentification récente : l'analyse avant le code

**Document destiné à ChatGPT.** 25 août 2026. **Aucune ligne n'est codée** : son
brief demande de résoudre la liaison preuve ↔ session d'abord.

---

## 1. Le modèle de session RÉEL, constaté

| | Ce qu'Atlas fait |
|---|---|
| Stratégie | **JWT**, `src/auth.ts:35` — `session: { strategy: "jwt" }` |
| Durée | **aucun `maxAge` posé** → défaut d'Auth.js : **30 jours, glissants** |
| Table de sessions | **aucune** — il n'y a rien à supprimer pour fermer une session |
| Coupure globale | chaque jeton porte son instant de signature (`iat`), recopié en `session.user.emisLe` (`src/auth.config.ts:71`). `getCurrentCtx` refuse les jetons antérieurs à `users.jetons_valides_depuis` |
| Face ID | **second fournisseur `Credentials`** — un premier facteur ALTERNATIF, jamais un second |

## 2. Le point que le brief soulève, et il est juste

Une date globale `derniere_preuve_at` par utilisateur **profiterait à une session
volée** : le patron se ré-authentifie sur son iPhone, et l'ordinateur volé en
bénéficie dans la seconde. La preuve doit être liée à la session qui l'a obtenue.

### La liaison retenue : `iat`, l'instant de signature du jeton

**Elle existe déjà, et elle est inforgeable.** `iat` vit **à l'intérieur du JWT
signé** : le navigateur ne peut ni le choisir ni le modifier sans invalider la
signature. Atlas le lit déjà, pour la coupure globale.

Une preuve porterait donc `(utilisateur_id, jeton_emis_le, prouve_le)`, et une
opération sensible exigerait une preuve **pour SON propre `iat`**, récente.

| Menace | Ce qui se passe |
|---|---|
| session volée sur un autre ordinateur | son jeton a un **autre `iat`** → la preuve de l'iPhone ne lui sert à rien ✔ |
| le navigateur forge la preuve | impossible : elle est en base, posée par le serveur ✔ |
| il rejoue une vieille preuve | elle expire ✔ |
| « me déconnecter partout » | `jetons_valides_depuis` avance ; le jeton est refusé, **donc sa preuve aussi** ✔ *(gratuit : la liaison à `iat` fait le travail)* |
| changement de mot de passe | à faire expirer explicitement les preuves |

### La limite de cette liaison, dite franchement

**`iat` a une résolution d'UNE SECONDE.** Deux jetons du **même utilisateur**
signés dans la même seconde partageraient une preuve.

Pour en profiter, un attaquant devrait se connecter **dans la même seconde** que
le patron — ce qui suppose qu'il a déjà ses identifiants. Or dans ce cas la
ré-authentification ne protège de rien : il la passerait lui-même. **Le trou ne
s'ouvre que là où la protection n'a de toute façon plus d'objet.**

*(`jti` existe dans les types d'`@auth/core` mais n'est pas garanti présent ici.
S'il l'est réellement, il vaudra mieux qu'`iat` — à constater avant, pas à
supposer.)*

---

## 3. Les opérations sensibles — la liste RÉELLE, pas celle du brief

Le brief en énumérait sept. **Trois de ses hypothèses sont contredites par le
code**, et le brief demande alors de s'arrêter et de le dire.

| Opération | Où | Garde actuelle | Verdict |
|---|---|---|---|
| **Coordonnées bancaires / IBAN** | `src/app/reglages/identite/actions.ts:40` | `exigerProprietaire` | **à protéger** — c'est là que l'argent des clients arrive |
| **Enregistrer une clé Face ID** | `src/app/reglages/connexion/actions.ts:113` | session seule | **à protéger, et c'est le plus grave** — voir ci-dessous |
| **Retirer une clé Face ID** | `…:141` | session seule | **à protéger** — priver le patron de sa porte |
| **Export complet des données** | `src/app/api/mes-donnees/route.ts` | `exigerProprietaire` | **à protéger** — toute l'entreprise en un fichier |
| Changer le mot de passe | `…:28` | **exige le mot de passe actuel** | **déjà fait** — c'est une preuve récente, vérifiée en base depuis M9 |
| « Me déconnecter partout » | `…:54` | session seule | **NE PAS protéger** — voir ci-dessous |
| Changement de rôle | — | — | **n'existe pas** dans Atlas |
| `exporterClient` / `effacerClient` | `src/server/repositories/donnees-client.ts` | — | **aucun écran ne les appelle** (confirme F7) |

### Le plus grave n'était pas dans le brief : la clé Face ID

Une session volée peut aujourd'hui **enregistrer la clé de l'appareil de
l'attaquant**. Il obtient alors une porte à lui, qui **survit à un changement de
mot de passe** — le patron reprend la main sur son compte et l'intrus entre
toujours. C'est le seul geste de cette liste qui rend l'accès *permanent*.

### Pourquoi « me déconnecter partout » ne doit PAS l'exiger

C'est le geste d'urgence de quelqu'un qui **craint justement d'être volé**. Lui
réclamer son mot de passe au moment où il veut fermer les portes, c'est le
retarder — et il est peut-être sur un chantier, sans son gestionnaire de mots de
passe. Une protection qui gêne la victime et pas l'attaquant est une mauvaise
protection.

---

## 4. Ce que la preuve devra tenir

| Exigence du brief | Comment |
|---|---|
| créée seulement après vérification réelle | posée par le serveur, dans le même geste que `verifier_mot_de_passe_de` ou une signature WebAuthn |
| vérifiée côté serveur | une lecture en base dans l'action, avant toute écriture |
| expire vite | quelques minutes — valeur à arbitrer avec le patron |
| non forgeable par le navigateur | elle n'y transite jamais ; l'écran n'envoie aucun jeton de preuve |
| ne profite pas à une autre session | liée à l'`iat` du jeton |
| invalidée après coupure / changement de sécurité | la coupure invalide le jeton, donc sa preuve ; le changement de mot de passe les effacera explicitement |

---

## 5. Ce que je ne ferai pas

- **`session.maxAge` ne bouge pas.** Un artisan déconnecté sur un chantier coûte
  plus cher que le risque traité, et la ré-authentification traite le vrai
  danger — une session volée qui peut tout — sans toucher au travail ordinaire.
- **Aucune modale ne décidera de rien.** Ce que l'écran envoie n'est jamais une
  preuve.
