# Atlas — Lot 2 sécurité (M1 → M6) : ce qui tient, ce qui manque, ce qui casserait

**Document destiné à ChatGPT**, en réponse à son brief « Atlas — Correction
sécurité Lot 2 ». Écrit le 24 août 2026, après lecture du code — chaque verdict
porte le fichier et la ligne qui le fonde.

**Rien n'a été codé de ce lot.** Le Lot 1 (C1, E1, E2, E3, M7, M8) et « Ouvrir
avec Face ID » sont faits, éprouvés et sur `main` ; le Lot 2 attend l'arbitrage
du patron.

---

## 0. Une correction à mon propre premier avis

Ma première lecture affirmait que la route qui sert les fichiers n'avait
**« ni `nosniff`, ni `Content-Disposition` »**. C'est faux pour la première
moitié : `next.config.ts:60` pose

```
{ key: "X-Content-Type-Options", value: "nosniff" }
```

sur `source: "/(.*)"`, donc sur **toutes** les routes, l'API comprise. Le
diagnostic de M1 ci-dessous en tient compte — et la conclusion ne change pas,
pour une raison qui mérite d'être dite : **`nosniff` ne ferme pas ce trou-là.**

---

## 1. Tableau de verdicts

| | Verdict | En un mot |
|---|---|---|
| **M1** — type servi | **à faire, autrement** | le trou est réel, mais `nosniff` ne le bouche pas ; c'est la liste blanche à l'entrée qui le bouche |
| **M2 / M3** — liste blanche + métadonnées | **à faire, et c'est le point dangereux** | resserrer sans toucher aux attributs `accept` refuse les photos HEIC d'iPhone |
| **M4** — cadence sur les téléversements | **à moitié déjà fait** | seul l'import de tarifs est réellement découvert |
| **M5** — bombe zip | **à faire, mais pas pour la raison donnée** | le vecteur multi-entrées n'existe pas ; le vrai tient en une option |
| **M6** — plafond d'octets | **déjà fait, ne pas y toucher** | réécrire le chemin de téléversement, c'est du risque contre rien |

---

## 2. M1 — le type servi vient du navigateur

### Le constat

`src/app/api/fichiers/[...key]/route.ts:48`

```ts
headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=3600" }
```

`mimeType` est lu en base, et il y a été écrit tel que **le navigateur l'a
déclaré** au téléversement (`photos-actions.ts:42` : `mimeType: fichier.type`). Rien ne le recalcule côté serveur.

### Pourquoi `nosniff` ne suffit pas

`nosniff` interdit au navigateur de **deviner** un type autre que celui annoncé.
Ici, personne ne devine : on annonce `image/svg+xml`, et le navigateur fait
exactement ce qu'on lui dit — il rend un document SVG.

Et la politique de sécurité du contenu ne rattrape pas non plus, parce qu'elle
autorise l'inline (`next.config.ts:19-22`) :

```
script-src 'self' 'unsafe-inline'
```

Un `<script>` à l'intérieur d'un SVG servi depuis notre propre domaine
s'exécute donc, avec la session de l'artisan.

### Ce qui limite la portée, et qu'il faut dire

- il faut **être déjà connecté** dans l'entreprise pour déposer le fichier : ce
  n'est pas une attaque anonyme ;
- l'affichage ordinaire passe par `<img src=…>`, **et un SVG en `<img>`
  n'exécute rien**. Le déclenchement demande une navigation directe vers
  l'adresse du fichier.

Ce n'est donc pas une urgence rouge. Mais cela le devient le jour où plusieurs
personnes partagent une entreprise — c'est-à-dire au moment exact où le modèle
de rôles (éditeur / patron / commercial / salarié) sera implémenté.

### La correction retenue

**La liste blanche à l'entrée (M2), et elle suffit.** Interdire `image/svg+xml`
au dépôt ferme le vecteur à la source, sans toucher à la route de lecture.

En complément, gratuit : **ne plus servir le type déclaré par le client** mais
le dériver de l'extension de la clé de stockage — c'est déjà ce que fait
`src/app/api/phyto/image/[id]/route.ts:60` (`typeDepuisCle`). Une implémentation
existe, il n'y a qu'à la reprendre plutôt qu'à en écrire une seconde.

**À ne pas faire :** `Content-Disposition: attachment` sur cette route. Les
photos de chantier s'affichent en ligne dans l'application ; l'attachement
casserait l'affichage pour supprimer un risque que la liste blanche supprime
déjà.

---

## 3. M2 / M3 — la liste blanche et les métadonnées : **le point dangereux du lot**

### L'état des lieux, écran par écran

| Écran | Attribut `accept` | Contrôle serveur | Métadonnées |
|---|---|---|---|
| Photos de chantier — `Pellicule.tsx:127` | `image/*` | `startsWith("image/")` (`photos-actions.ts:20`) | **gardées** |
| Croquis d'arrosage — `ArrosageClient.tsx:267` | `image/*` | aucun contrôle de type | n/a (pas stocké) |
| Tickets de TVA — `AchatsTva.tsx:219` | `image/*` | `startsWith("image/")` (`termines/tva/actions.ts:100`) | **gardées** |
| Diagnostic végétal — `PrendreUnePhoto.tsx:46` | `image/jpeg,image/png,image/webp` | `typeImageAccepte` (`diagnostic/actions.ts:81`) | **retirées** (`retirerMetadonnees`) |

Le diagnostic fait déjà tout bien. Le brief a raison : il n'y a qu'à reprendre.

### Le danger, et il est concret

`src/lib/exif.ts:41` :

```ts
export const TYPES_IMAGE_ACCEPTES = ["image/jpeg", "image/png", "image/webp"] as const;
```

**Un iPhone photographie en HEIC.** S'il transcode en JPEG à l'envoi, c'est
**parce que l'attribut `accept` le lui demande** — c'est exactement ce que fait
`PrendreUnePhoto.tsx:46`, et c'est pourquoi le diagnostic fonctionne.

Les trois autres écrans portent `accept="image/*"`. Resserrer la liste blanche
**côté serveur seulement** produit donc, sur un chantier, un artisan qui
photographie son ticket de caisse et lit un refus — sans comprendre, avec le
ticket encore à la main.

> **Le mot « HEIC » n'apparaît nulle part dans le dépôt.** Rien n'est prévu pour
> ce format aujourd'hui.

### Les trois règles à tenir

1. **Les `accept` et la liste serveur bougent ENSEMBLE, dans le même lot.** Pas
   l'un puis l'autre.
2. **Un échec de nettoyage ne doit JAMAIS refuser la photo.** `retirerMetadonnees`
   rend déjà `{ nettoye: false }` plutôt que de lever (`exif.ts`) — il faut
   garder ce comportement : on stocke sans nettoyer plutôt que de perdre le
   cliché. *Un outil qui refuse la photo qu'on vient de prendre est pire que le
   risque qu'il évite.*
3. **Décider explicitement du sort du HEIC** : soit on l'accepte et on le
   nettoie (nouveau code), soit on garde `accept` assez large pour qu'iOS
   transcode. Ce qu'il ne faut pas, c'est trancher par omission.

### Sur M3 (les métadonnées GPS) — d'accord sans réserve

Les photos de chantier portent les coordonnées GPS du domicile d'un client.
C'est une donnée personnelle qu'on n'a jamais choisi de garder, et le nettoyage
existe déjà. Rien ne s'y oppose.

---

## 4. M4 — la cadence : à moitié faite

Ce qui existe déjà (`LIMITES.televersementFichier` = 20/min/entreprise) :

- photos de chantier — `photos-actions.ts:32`
- tickets de TVA — `termines/tva/actions.ts:108`
- diagnostic végétal — limite dédiée `diagnosticVegetal` (10/min), plus serrée
  parce qu'elle borne une facture d'IA

Ce qui manque **vraiment** :

- **l'import de tarifs** — `src/app/reglages/actions.ts` : aucun
  `verifierLimite`. C'est aussi le seul chemin qui décompresse quelque chose
  (voir M5). Les deux se corrigent au même endroit.
- l'arrosage (`paysage/arrosage/actions.ts`) n'a pas de limite non plus, mais il
  exige déjà une session et borne la taille à 8 Mo.

**Pas de désaccord sur le principe.** Simplement : la moitié du travail est
faite, et il ne faut pas la refaire.

---

## 5. M5 — la bombe zip : le bon défaut, la mauvaise cause

### Ce que le brief décrit n'existe pas

Le brief craint une archive à **plusieurs entrées gonflées**. Or
`src/server/import/lire-classeur.ts:23` (`lireEntreeZip`) parcourt le répertoire
central **sans rien décompresser**, et n'inflate que l'entrée dont le nom
correspond — `xl/worksheets/sheet1.xml`, puis `xl/sharedStrings.xml`
(lignes 122-124). Cinquante entrées piégées ne coûtent rien.

### Le vrai défaut, et il est plus simple

`lire-classeur.ts:51`

```ts
if (methode === 8) return inflateRawSync(brut).toString("utf8");
```

**Aucun `maxOutputLength`.** Une seule entrée bien compressée — la borne d'entrée
est à 5 Mo (`reglages/actions.ts:81`) — rend plusieurs gigaoctets et couche le
processus. C'est une option à passer, pas une réécriture.

### Un second point, mineur

La boucle `for (let i = 0; i < nombreEntrees; i++)` lit `nombreEntrees` depuis
l'archive (ligne 29) et appelle `archive.readUInt32LE(position)` sans borner
`position`. Sur une archive forgée, cela lève un `RangeError` — donc une erreur
opaque pour l'utilisateur plutôt qu'un message clair. À borner par la même
occasion.

---

## 6. M6 — le plafond d'octets : déjà en place

- `next.config.ts:74` — `bodySizeLimit: "15mb"` sur les actions serveur, valeur
  explicite et commentée (le défaut de Next.js à 1 Mo était insuffisant pour une
  photo de téléphone).
- `src/server/upload-limits.ts` — `verifierTailleFichier` lit `fichier.size`
  **avant** tout `arrayBuffer()`. Un fichier surdimensionné est refusé sans
  passer par la mémoire.

### Pourquoi un plafond « au fil de l'eau » n'est pas atteignable ici

Next.js met le corps de la requête en mémoire **avant** de rendre la main à
l'action serveur : il n'y a pas de flux à interrompre à notre niveau. Le
plafond est déjà appliqué par le framework, en amont de notre code.

**Recommandation : ne rien changer.** Réécrire le chemin de téléversement pour
obtenir un contrôle qu'on a déjà, c'est du risque de régression contre zéro
gain.

---

## 7. Ce que le brief n'a pas vu

1. **`src/app/reglages/actions.ts` est le seul chemin qui décompresse**, et
   c'est aussi le seul sans limite de débit. C'est là qu'il faut concentrer M4
   et M5 — un point, pas deux.
2. **Le croquis d'arrosage** (`paysage/arrosage/actions.ts:116`) envoie la photo
   à un fournisseur d'IA. Il borne la taille (8 Mo) mais ne contrôle aucun type
   et n'a pas de limite de débit. Il n'était dans aucun des six points.
3. **`Pellicule.tsx` stocke `nomOriginal: fichier.name`**, une chaîne venue du
   client, restituée telle quelle. Sans conséquence aujourd'hui, à surveiller le
   jour où ce nom entre dans un en-tête ou un nom de fichier d'export.

---

## 8. Ordre de travail proposé

| # | Quoi | Pourquoi d'abord |
|---|---|---|
| 1 | `maxOutputLength` sur `inflateRawSync` + limite de débit sur l'import de tarifs | une ligne et demie, aucun risque, ferme le seul vecteur qui couche le serveur |
| 2 | Type servi dérivé de la clé de stockage (`typeDepuisCle`) | code déjà écrit ailleurs, aucun effet sur l'affichage |
| 3 | Liste blanche + métadonnées, **avec les `accept`**, et la question HEIC tranchée | le gros du lot, et le seul qui puisse gêner un artisan sur un chantier |
| 4 | Contrôle de type + débit sur le croquis d'arrosage | hors brief, même famille |

**Ne pas faire :** M6, et `Content-Disposition: attachment` sur la route des
fichiers.

---

## 9. Ce qui n'est pas dans ce lot, et pourquoi

- **Les sauvegardes.** Il n'y en a aucune. « Télécharger mes données » est un
  export manuel, pas une sauvegarde. C'est le point le plus grave du dépôt
  aujourd'hui, il ne se règle pas en codant, et il attend une décision
  d'hébergement (`TODO.md`).
- **La double authentification (M11).** Elle est en partie répondue depuis le
  24 août : « Ouvrir avec Face ID » vaut à lui seul deux facteurs — le téléphone
  qu'on possède et le visage qui l'ouvre — sans code à recopier avec les mains
  sales. Reste la durée de session, encore au défaut d'Auth.js (trente jours).
