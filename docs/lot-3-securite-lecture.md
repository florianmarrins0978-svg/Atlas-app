# Atlas — Lot 3 : lecture avant tout code

**Document destiné à ChatGPT**, en réponse à son brief « Sécurité Lot 3 ».
25 août 2026. **Aucune ligne de code n'a été écrite.**

Conformément à la règle du dépôt (`CLAUDE.md` §2 bis), un texte transmis par le
patron se lit et se confronte au code **avant** d'être exécuté. Ce qui suit dit,
point par point : ce qui est fondé, ce qui est déjà fait, ce qui est faux, et ce
qui casserait l'application.

---

## En un tableau

| | Verdict | Fondé sur |
|---|---|---|
| **M9** — `password_hash` accessible à `atlas_app` | **FONDÉ** | aucune politique RLS ni `REVOKE` sur `users` dans `drizzle/*.sql` |
| **M10** — dépendances | **FONDÉ**, mais son remède est un piège | `npm audit` : 11 alertes, **toutes** transitives par Next |
| **M11** — session longue, pas de ré-authentification | **FONDÉ** | `src/auth.ts:35` — `session: { strategy: "jwt" }`, **sans `maxAge`** |
| **M12** — mise à jour du banc sans rôle | **FONDÉ, et pire que décrit** | `src/app/reglages/actions.ts:294` |
| **F6** — migrations en double | **FAUX PROBLÈME** | le lanceur suit les **noms de fichiers** |
| **F13** — pas de `robots.txt` | **VRAI**, et trivial | aucun fichier |
| **Audio** | **VRAI**, et déjà consigné par nous | `src/server/upload-limits.ts:46` |
| **Sauvegardes** | **VRAI** | aucun fournisseur déclaré dans le dépôt |

---

## M9 — le point le plus important du lot, et le plus facile à casser

### Ce qui est constaté

`users` n'a **aucune** politique RLS, et aucun `REVOKE` ne restreint la colonne.
`atlas_app` peut donc lire tous les condensats. Le constat est juste.

### Ce que le brief ne dit pas, et qui rend la correction faisable

**Seuls trois endroits touchent réellement `password_hash`** :

| Où | Quoi | Contexte disponible |
|---|---|---|
| `src/auth.ts:48-50` | vérifier le mot de passe à la connexion | **aucun** — ni utilisateur, ni entreprise |
| `src/server/repositories/compte.ts:79` | vérifier l'ancien mot de passe | `utilisateurId` |
| `src/server/repositories/compte.ts:101` | écrire le nouveau | `utilisateurId` |

*(`seed.ts` écrit la démonstration ; il tourne sous le rôle propriétaire.)*

**Face ID ne lit pas `password_hash`** — c'est important, et cela contredit
l'inquiétude implicite du brief : `src/server/repositories/cles-appareil.ts` ne
touche que la table des clés.

### La solution que je retiendrais, et pourquoi

**Un `REVOKE` de colonne, pas une RLS.** PostgreSQL sait retirer le droit sur
une seule colonne :

```sql
REVOKE SELECT (password_hash) ON users FROM atlas_app;
```

`atlas_app` garde `SELECT` sur le reste — les écrans d'équipe lisent des noms et
des courriels —, et perd exactement ce qu'on veut lui retirer. La propriété
demandée par le brief est alors tenue **par le moteur**, pas par une convention.

Les trois lectures ci-dessus passent alors par une **fonction `SECURITY DEFINER`
qui ne rend jamais le condensat** : elle prend un mot de passe et répond oui ou
non. Le condensat ne sort plus de la base du tout.

**Le brief a raison de refuser une RLS par `entreprise_id` sur `users`** : un
utilisateur est rattaché à une entreprise *après* s'être identifié, et la
connexion se fait sans contexte. Une RLS y rendrait la connexion impossible.

### CE QUI CASSERAIT, et qu'il faut avoir en tête

1. **Un `SELECT *` sur `users` échouerait.** Il faut d'abord vérifier qu'aucun
   appel Drizzle ne sélectionne la table entière — sinon le correctif fait
   tomber des écrans qui n'ont rien à voir avec l'authentification.
2. **L'échec serait invisible ici.** Nos suites tournent parfois sous un rôle qui
   traverse la RLS. Un contrôle sous `atlas_app` est indispensable, sans quoi on
   livrerait une connexion cassée en croyant l'avoir durcie.
3. **La migration doit être jouée sur son banc** avant toute production.

---

## M10 — le constat est juste, le remède proposé est le vrai danger

### Ce que `npm audit` rend aujourd'hui

```
11 vulnerabilities (4 moderate, 7 high)
```

| Paquet | Nature | Direct ? | Correctif annoncé |
|---|---|---|---|
| `postcss` | lecture de fichier arbitraire par `sourceMappingURL` | **non** — `node_modules/next/node_modules/postcss` | `next@16.3.2` |
| `sharp` / libvips | 4 CVE | **non** — tiré par Next | `next@16.3.2` |

**Aucune des deux n'est une dépendance directe d'Atlas.** `package.json` ne
déclare ni `sharp` ni `postcss` : les deux viennent de `next: "16.2.12"`.

### Le piège, et il est exactement où le brief le craint

`npm audit` propose `npm audit fix --force` et annonce *« Will install
next@16.3.2, which is outside the stated dependency range »*. Cette phrase fait
peur à tort **et** rassure à tort :

- **elle fait peur à tort** : 16.2 → 16.3 est une montée **mineure**, pas
  majeure. « Hors plage » ne dit que ceci : la version est **épinglée au patch**
  dans `package.json` ;
- **elle rassure à tort** : `--force` ne s'arrêterait pas là, et le dépôt
  interdit ce geste.

**Ce que je propose :** monter Next à `16.3.2` **à la main**, une ligne, puis la
batterie complète. C'est le seul geste qui ferme les onze alertes, et il ne
touche pas à l'authentification.

**Ce que je ne propose pas :** migrer `next-auth` hors de sa bêta. La version
5.0.0-beta est celle qu'Atlas éprouve depuis le début, Face ID compris. Le brief
autorise lui-même à documenter plutôt qu'à refondre — c'est le bon choix.

---

## M11 — le constat est juste, et une correction de fond mérite d'être faite

### Ce que le code fait VRAIMENT, sans complaisance

```ts
// src/auth.ts:35
session: { strategy: "jwt" },
```

**Aucun `maxAge` n'est posé.** La session dure donc ce que Auth.js décide par
défaut — **trente jours, glissants**. Le constat de l'audit tient.

### Face ID n'est PAS une 2FA — et il faut le dire net

Le brief demande de ne jamais l'affirmer sans démontrer l'architecture. Voici
l'architecture réelle :

| | Ce qu'Atlas fait |
|---|---|
| **Ce que c'est** | un **second fournisseur `Credentials`** dans `src/auth.ts`, à côté du mot de passe |
| **Ce que cela veut dire** | c'est un **premier facteur alternatif** : on entre *soit* par mot de passe, *soit* par la clé de l'appareil |
| **Ce que ce n'est pas** | un second facteur. Rien n'exige les deux |
| **Ce qui est vraiment vérifié** | une signature WebAuthn, contre un défi posé dans un cookie `httpOnly`/`sameSite=strict` et consommé à la lecture |

**Face ID au sens d'Apple n'entre jamais dans Atlas** : il déverrouille la clé
sur l'appareil ; c'est la **clé** qui signe, et c'est la signature qu'Atlas
vérifie.

### La ré-authentification récente : d'accord, et voici la seule forme qui tient

L'idée du brief est bonne, et sa borne l'est aussi : **la preuve doit être
vérifiée côté serveur**. Concrètement, cela veut dire :

- **pas** un booléen dans un état React ;
- **pas** un champ de formulaire ;
- une **marque datée, posée par le serveur** au moment où le mot de passe ou la
  clé a réellement été vérifié, et relue par l'action sensible.

Ce que je vérifierais avant de coder : où poser cette marque sans toucher à la
session (le dépôt tient à ne pas remuer cette couche). Un enregistrement en base
portant `utilisateur_id` et l'instant de la dernière preuve est le candidat le
plus simple, et il survit à un renouvellement de jeton.

**Sur `session.maxAge` :** je ne le changerais **pas** dans ce lot. Un artisan
qui se fait déconnecter sur un chantier appellera le patron, et le remède aurait
coûté plus cher que le mal. La ré-authentification récente traite le vrai risque
— une session volée qui peut tout — sans toucher au travail ordinaire.

---

## M12 — fondé, et le brief a raison de parler des DEUX mécanismes

### Ce qui est constaté, mot pour mot

```ts
// src/app/reglages/actions.ts:294
export async function mettreAJourApplicationAction(): Promise<ResultatMiseAJour> {
  await getCurrentCtx(); // Réservé à quelqu'un de connecté, comme le reste de l'écran.

  if (process.env.ATLAS_BANC_ESSAI !== "1") {
```

**N'importe quel compte connecté** — un membre, pas seulement le propriétaire —
peut donc lancer un `git pull` et des migrations sur le banc. L'audit dit vrai.

### Et l'incohérence que le brief redoutait EXISTE

Le dépôt porte une fonction unique pour reconnaître le banc :

```ts
// src/profil-banc.ts:55
return env.ATLAS_PROFIL?.trim().toLowerCase() === "banc" || env.ATLAS_BANC_ESSAI?.trim() === "1";
```

**Cette action ne l'emploie pas** : elle lit `ATLAS_BANC_ESSAI` en direct. Sur un
banc démarré par `ATLAS_PROFIL=banc` seul — ce que fait `.devcontainer/demarrer.sh`
— le bouton **refuserait**. C'est un défaut réel, trouvé grâce à sa question.

**Correction : `exigerProprietaire()` + `estBancDEssai()`.** Deux lignes, aucun
risque, et un contrôle de rôle qui rougit sur l'ancien code.

---

## Ce qui est FAUX, ou déjà réglé

### F6 — migrations en double : ne rien faire, et surtout ne rien renommer

`drizzle/` porte deux fichiers `0063_*`. **Ce n'est pas un défaut** :
`scripts/run-migrations.ts` suit les migrations par **nom de fichier** dans une
table `_migrations`, et les applique par ordre alphabétique. Deux noms distincts
sont deux migrations distinctes.

**Renommer serait la seule façon de casser quelque chose** : le nouveau nom
serait vu comme une migration jamais appliquée, et rejoué. C'est déjà écrit dans
`HANDOVER.md` §77.

### F3 — la route de diagnostic est déjà bornée

Le brief craint qu'elle expose l'environnement en production. Elle porte déjà
`if (process.env.NODE_ENV === "production") return []` sur le calcul des
origines. **Reste à vérifier** ce que le corps de la réponse rend en production —
c'est un contrôle à écrire, pas une correction à supposer.

### Audio — déjà constaté et consigné par nous, au Lot 2B

`verifierTypeAudio` ne regarde que le type déclaré
(`src/server/upload-limits.ts:46`). Nous l'avions écrit dans le verdict du Lot 2B
et dans `TODO.md` — ce n'est pas une découverte du brief, et c'est bien.

**Ce que le brief ne dit pas, et qui borne le risque :** le type **servi** n'est
plus le type déclaré depuis M1 — il est dérivé de l'extension de la clé, choisie
par le serveur. Ce qui reste possible est de **ranger** un fichier inerte sous
une extension audio, pas de le faire exécuter.

Une vérification par signature est faisable et légère (WebM/Matroska, MP4/M4A,
OGG, WAV ont des en-têtes courts et stables). **Le piège** : un iPhone envoie du
MP4/AAC et un navigateur Android du WebM/Opus ; une liste trop étroite ferait
refuser des dictées réelles sur un chantier. C'est à éprouver avant de livrer,
pas après.

---

## Ce que je dirais du périmètre

**Ce brief n'est pas un lot, c'en est trois ou quatre.** M9 seul touche à la
connexion — ce qui casse le plus mal et se voit le plus tard. M11 demande une
pièce nouvelle. À quoi s'ajoutent treize constats et une politique de sauvegarde.

L'ordre que je propose, du plus utile au moins risqué :

| | Pourquoi d'abord |
|---|---|
| **1. M12** | deux lignes, aucun risque, et un vrai trou de rôle |
| **2. M10** | une ligne, ferme onze alertes, et la batterie tranche |
| **3. M9** | le vrai sujet, et celui qui demande le plus de contrôles |
| **4. M11** | la pièce neuve, une fois le reste stable |
| **5. F1–F13** | à trier, la plupart sont des minutes |
| **6. Audio** | faisable, à éprouver sur de vraies dictées |
| **7. Sauvegardes** | **rien à coder** tant que l'hébergement n'est pas choisi |

**Sur les sauvegardes, je suis d'accord avec lui sans réserve** : le dépôt ne
peut pas produire une sauvegarde de production, et un script local présenté comme
telle serait pire que rien. Le point reste :

> **BLOQUANT PRODUCTION — SAUVEGARDE/RESTAURATION NON ÉPROUVÉE.**

---

## Ce que je ne ferai pas sans son accord

- **toucher à `session.maxAge`** — cela se voit sur son téléphone, pas ici ;
- **migrer `next-auth`** hors de sa bêta ;
- **supprimer `unsafe-inline`** de la CSP (F10) : Next pose des scripts en ligne,
  et une CSP à nonce se joue dans le `middleware`. Faisable, mais c'est un lot à
  soi — et une CSP mal posée rend l'application blanche ;
- **construire une interface d'export/effacement client** (F7) : c'est une
  décision produit et RGPD, pas une correction de sécurité.
