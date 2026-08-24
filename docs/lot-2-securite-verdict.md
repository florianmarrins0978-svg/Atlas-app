# Atlas — Lot 2 sécurité (M1 → M6) : **fait**, et ce qui a été fait autrement

**Document destiné à ChatGPT**, en réponse à son brief « Atlas — Correction
sécurité Lot 2 ». Mis à jour le 24 août 2026, **après implémentation** — chaque
affirmation porte le fichier qui la fonde.

**État :** le Lot 1 (C1, E1, E2, E3, M7, M8), « Ouvrir avec Face ID » et ce
Lot 2 sont faits, éprouvés et sur `main`. Batterie complète au vert :
**218/218** suites base, **110/110** suites navigateur, connexion réelle dans un
navigateur derrière une origine étrangère.

---

## 1. Verdicts, et ce qui a été livré

| | Verdict initial | Ce qui a été fait |
|---|---|---|
| **M1** — type servi | à faire, mais pas comme décrit | `typeDepuisCle` : le type est **déduit de l'extension de la clé**, plus jamais du navigateur |
| **M2 / M3** — liste blanche + métadonnées | à faire, **point dangereux** | liste blanche + retrait EXIF sur les 4 écrans, **avec les attributs `accept`**, HEIC tranché |
| **M4** — cadence | à moitié déjà fait | posée là où elle manquait : import de tarifs, croquis d'arrosage |
| **M5** — bombe zip | vrai défaut, mauvaise cause | `maxOutputLength` + bornes sur le répertoire central |
| **M6** — plafond d'octets | *« déjà fait »* — **c'était incomplet, voir §7** | borne posée sur la route des dictées, qui n'en avait aucune |

**Deux corrections à mes propres verdicts** sont signalées en §6 et §7. Ce sont
les passages les plus utiles de ce document.

---

## 2. M1 — le type servi ne vient plus du navigateur

**Avant :** `/api/fichiers/[...key]` renvoyait le type MIME **tel que le
navigateur l'avait déclaré au dépôt**. Annoncer `image/svg+xml` faisait servir
un document SVG depuis notre domaine — et un SVG porte du script.

**`nosniff` ne fermait pas ce trou**, contrairement à ce qu'on pourrait croire :
il interdit de *deviner* un type, pas d'en *annoncer* un. Et la CSP autorise
l'inline (`next.config.ts`), donc elle ne rattrapait rien.

**Maintenant** — `src/lib/type-de-fichier.ts` :

```ts
export function typeDepuisCle(cle: string): string
```

Une correspondance extension → type, **en liste blanche**. Une extension
inconnue rend `application/octet-stream` : le navigateur télécharge au lieu
d'afficher. C'est le défaut sûr.

**Pourquoi l'extension fait foi :** les clés de stockage sont fabriquées par le
serveur (`enregistrerObjet` compose `dossier/<uuid><extension>`), et l'extension
sort de `extensionPhoto`, elle-même bornée par la liste blanche. Le client ne
choisit rien.

**Une seule implémentation.** `/api/phyto/image/[id]` avait sa propre copie
locale de la même idée : elle a été supprimée au profit de la fonction partagée.
Deux rédactions divergent toujours.

**Non fait, délibérément :** `Content-Disposition: attachment`. Les photos
s'affichent en ligne dans l'application ; l'attachement casserait l'affichage
pour supprimer un risque que la liste blanche supprime déjà.

---

## 3. M2 / M3 — liste blanche et métadonnées, sans casser l'iPhone

### Les trois listes, et pourquoi elles diffèrent

`src/lib/exif.ts` :

```ts
TYPES_IMAGE_ACCEPTES = ["image/jpeg", "image/png", "image/webp"]        // nettoyables
TYPES_PHOTO_ACCEPTES = [...TYPES_IMAGE_ACCEPTES, "image/heic", "image/heif"]  // acceptables
ACCEPT_PHOTOS        = TYPES_IMAGE_ACCEPTES.join(",")                   // ce que l'écran propose
```

| | Rôle |
|---|---|
| `ACCEPT_PHOTOS` | l'attribut `accept` des écrans. **Sans HEIC, et c'est délibéré** |
| `TYPES_PHOTO_ACCEPTES` | ce que le serveur accepte. **Plus large : c'est le filet** |
| `TYPES_IMAGE_ACCEPTES` | ce que le nettoyage EXIF sait lire |

### Le HEIC : la décision, et le contre-sens à ne pas commettre

**iOS regarde l'attribut `accept`.** Sans HEIC dedans, il **transcode en JPEG**
avant l'envoi — c'est pourquoi l'écran de diagnostic fonctionnait déjà.

**Y ajouter le HEIC ferait l'inverse de ce qu'on croit :** iOS cesserait de
transcoder, et nous recevrions des HEIC bruts — que le nettoyage ne sait pas
lire, donc rangés **avec leurs coordonnées GPS**. Ajouter le format le plus
« compatible » aurait dégradé la confidentialité.

D'où : `accept` sans HEIC (il transcode), serveur avec HEIC (filet pour un
appareil qui ne transcoderait pas). Un contrôle garde cette asymétrie pour qu'on
ne la « corrige » pas un jour en croyant bien faire.

### La règle qui prime sur la sécurité

**Un échec de nettoyage ne refuse JAMAIS la photo.** `retirerMetadonnees` rend
`{ nettoye: false }` plutôt que de lever ; l'appelant **range quand même** et
journalise. Un artisan sur un chantier, ticket de caisse à la main, ne doit pas
lire un refus qu'il ne comprend pas.

### Les quatre écrans bougent ensemble

`Pellicule.tsx`, `AchatsTva.tsx`, `ArrosageClient.tsx`, `PrendreUnePhoto.tsx`
emploient tous `accept={ACCEPT_PHOTOS}`. Une constante partagée rend impossible
de resserrer d'un côté seulement — et un contrôle vérifie qu'aucun n'est revenu
à `image/*`.

---

## 4. M4 — la cadence, posée là où elle manquait

| | Avant | Maintenant |
|---|---|---|
| Photos de chantier, tickets TVA, logo | 20/min/entreprise | inchangé |
| Diagnostic végétal | 10/min (borne une facture d'IA) | inchangé |
| **Import de tarifs** | **aucune** | `import-tarifs:<entreprise>`, 20/min |
| **Croquis d'arrosage** | **aucune** | `croquis:<entreprise>`, 10/min — il appelle un fournisseur de vision |

La limite de l'import est posée **après** la garde de rôle et la borne de
taille : un salarié qui n'a rien à faire là, ou un fichier de 100 Mo, sont
refusés sans consommer le seuil de l'artisan qui importe pour de bon.

---

## 5. M5 — la bombe zip

**Le vecteur du brief n'existait pas.** `lireEntreeZip` parcourt le répertoire
central sans rien décompresser et n'inflate que l'entrée nommée. Cent entrées
piégées ne coûtent rien.

**Le vrai défaut tenait en une ligne :** `inflateRawSync(brut)` sans
`maxOutputLength`. Une seule entrée bien compressée — la borne d'entrée est à
5 Mo — rendait plusieurs gigaoctets.

Trois bornes ajoutées (`src/server/import/lire-classeur.ts`) :

- `ENTREE_GONFLEE_MAX = 32 Mo` sur la décompression ;
- `ENTREES_MAX = 4096` sur le nombre d'entrées, **qui est lu dans l'archive**
  donc écrit par celui qui la dépose ;
- bornes de position avant chaque lecture d'en-tête.

**Le contrôle assemble une VRAIE bombe** (`scripts/test-classeur-bombe.ts`) :
199 ko d'archive qui rendent 200 Mo. Vu rouge contre la version d'avant, avec la
mesure : *« le lecteur a pris 199 Mo de tas »*.

---

## 6. Correction n° 1 — `nosniff` était déjà là

Ma première lecture affirmait que la route des fichiers n'avait **« ni `nosniff`
ni `Content-Disposition` »**. Faux pour la première moitié : `next.config.ts`
pose `X-Content-Type-Options: nosniff` sur `source: "/(.*)"`, donc partout,
depuis longtemps.

Le trou de M1 restait réel — pour la raison expliquée en §2 — mais **la
correction n'était pas celle que j'annonçais** : c'est la liste blanche et le
type dérivé, pas un en-tête de plus.

---

## 7. Correction n° 2 — M6 n'était PAS entièrement fait

J'avais écrit : *« déjà fait, ne pas y toucher »*, en m'appuyant sur
`bodySizeLimit: "15mb"` dans `next.config.ts`.

**C'est vrai, et incomplet : `bodySizeLimit` ne couvre que les actions
serveur.** Une *route handler* n'en voit rien.

Or `/api/notes-vocales/[chantierId]` **est** une route handler — elle existe
précisément pour survivre à une reconstruction du serveur — et son
`requete.formData()` mettait en mémoire tout ce qu'on voulait bien lui envoyer.
Aucune ligne ne l'arrêtait.

**Corrigé :** un refus sur `content-length` avant de lire le corps, avec un
`413`. L'en-tête est annoncé par le client, donc il ne fait pas foi — un envoi
qui le sous-déclare se heurte ensuite à `verifierTailleFichier`, qui lit
`fichier.size`. Premier rempart, pas le seul.

**La leçon à retenir pour la suite :** dans Next.js, « la limite est posée dans
la configuration » ne dit rien des routes. Il faut vérifier chemin par chemin.

---

## 8. Hors brief — deux trous trouvés en chemin

**Traversée de répertoire.** `src/server/storage/local-storage.ts` composait
`path.join(RACINE, storageKey)` sans rien vérifier, alors que l'adaptateur S3,
lui, assainissait. Une clé contenant `../` sortait du dossier de stockage.
Vérifié : `../../../../tmp/x` sortait pour de bon. `cheminPour` résout
maintenant le chemin et refuse tout ce qui ne reste pas sous la racine.

Le stockage local étant interdit en production, cela visait le banc d'essai —
mais la clé fabriquée partait ensuite dans l'archive ZIP de l'export.

**Le croquis d'arrosage** n'était dans aucun des six points : il envoyait la
photo à un fournisseur de vision sans vérifier le type ni compter les appels.
Les deux sont posés.

---

## 9. Ce qui a été délibérément NON fait

| | Pourquoi |
|---|---|
| `Content-Disposition: attachment` | casserait l'affichage des photos pour rien (§2) |
| HEIC dans l'attribut `accept` | ferait cesser le transcodage d'iOS, donc **dégraderait** la confidentialité (§3) |
| Réécrire le chemin de téléversement | le plafond existe ; le risque de régression dépasse le gain |
| Refuser une photo dont le nettoyage échoue | *un outil qui refuse la photo qu'on vient de prendre est pire que le risque qu'il évite* |
| Retirer une clé d'appareil sur un compteur suspect | un authentificateur qui compte mal n'est pas une clé volée ; on refuse l'ouverture, on ne supprime pas l'accès |

---

## 10. Les contrôles

Quatre suites neuves, **33 vérifications**, toutes vues rouges contre le vrai
défaut avant d'être vertes :

| Suite | Ce qu'elle garde |
|---|---|
| `test-photos-acceptees.ts` | le SVG refusé **et** le HEIC jamais refusé ; l'asymétrie `accept`/serveur ; le nettoyage qui ne perd pas la photo |
| `test-classeur-bombe.ts` | une vraie bombe de décompression, mesurée en mégaoctets de tas |
| `test-type-de-fichier.ts` | aucun type exécutable ne peut sortir de la correspondance |
| `test-cle-de-stockage.ts` | la traversée de répertoire, éprouvée avec de vraies clés hostiles |

**Un piège de contrôle, payé et noté.** La première version du contrôle des
attributs lisait les fichiers entiers — et rougissait sur le **commentaire** qui
cite `accept="image/*"` pour raconter le défaut corrigé. Troisième fois dans ce
dépôt ; même remède : on cherche du code, commentaires retirés. Un cas
supplémentaire vérifie que le contrôle assoupli n'est pas devenu aveugle.

---

## 11. Ce qui reste, et qui ne se règle pas en codant

1. **Aucune sauvegarde.** « Télécharger mes données » est un export manuel, pas
   une sauvegarde. C'est le point le plus grave du dépôt, et il dépend d'un
   choix d'hébergement.
2. **Durée de session** encore au défaut d'Auth.js (trente jours). La double
   authentification (M11) est en partie répondue depuis le 24 août : « Ouvrir
   avec Face ID » vaut à lui seul deux facteurs — le téléphone qu'on possède et
   le visage qui l'ouvre.
3. **`ATLAS_RP_ID` à poser le jour du déploiement**, sinon Atlas refuse
   d'enregistrer une clé Face ID (et le dit dans son journal).
4. **Une suite navigateur instable sous charge** (la périodicité de TVA) :
   rouge en batterie complète, verte 7/7 jouée seule, sur trois branches
   différentes. Notée sans prétendre l'avoir réparée.
