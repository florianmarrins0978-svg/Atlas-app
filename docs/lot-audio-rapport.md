# Atlas — Lot Audio : le format se lit dans les octets

*26 août 2026 · branche `claude/atlas-securite-lot3` · **pas fusionné sur `main`***

> ## ✅ ESSAI RÉEL SUR IPHONE — RÉUSSI, le 26 août 2026
>
> **Le patron a dicté depuis son propre iPhone, dans Safari, sur son banc.** Pas
> un témoin fabriqué, pas une simulation : une note vocale telle qu'il s'en sert
> pour rédiger un devis.
>
> | | |
> |---|---|
> | l'enregistrement | a fonctionné |
> | le fichier | **a été accepté** |
> | la note | a été traitée |
> | le parcours | est allé jusqu'à la génération des informations du devis |
>
> **La réserve du §10.1 est LEVÉE.** Le durcissement ne casse pas la dictée
> réelle sur iPhone/Safari — ce n'est plus une déduction, c'est une mesure.
>
> **Ce que cet essai a fait apparaître, et qui n'est PAS de ce lot :** la qualité
> de ce qui sort du traitement — organisation des prestations, quantités et
> unités, reprise des prix historiques. **Lot séparé**, décidé par lui le
> 26 août. Le mélanger à celui-ci rendrait les deux illisibles.

---

## 1. Les formats finalement reconnus

| Format | Ce qui le produit |
|---|---|
| **WebM / Matroska** | Chrome sur Android et sur PC |
| **MP4 / M4A** | **Safari sur iPhone** |
| **OGG** | Firefox |
| **WAV** | import depuis un ordinateur |
| **FLAC** | import |
| **MP3** | import — le plus courant |
| **AAC brut (ADTS)** | import |

---

## 2. Comment chacun est reconnu

**Aucune bibliothèque. Aucun parseur de conteneur.** Des en-têtes lus à des
positions fixes, sur quelques kilo-octets au plus. Le précédent était dans le
dépôt : `src/lib/exif.ts` vérifie déjà des signatures d'images en TypeScript nu.

| Format | Méthode |
|---|---|
| **WebM** | la marque EBML `1A 45 DF A3`, **plus le `DocType`** (`webm`/`matroska`) dans les 64 premiers octets. La marque seule couvrirait toute vidéo Matroska |
| **MP4** | `ftyp` **à l'octet 4** — les quatre premiers portent la taille de la boîte. Plus trois contrôles : taille plausible (16 à 4096), alignée sur 4, et marque majeure imprimable |
| **OGG** | `OggS`, version 0, drapeau « début de flux », **plus le codec** (`OpusHead`, `vorbis`, `Speex`, `FLAC`) — sans lui, une vidéo Theora passerait |
| **WAV** | `RIFF` + `WAVE` + le morceau `fmt ` |
| **FLAC** | `fLaC`, type de bloc ≤ 6, et un STREAMINFO de 34 octets exactement |
| **MP3** | **une CHAÎNE de trames.** `ID3` est reconnu et sauté (taille *syncsafe*), puis au moins **trois trames consécutives** dont chacune tombe là où la précédente l'annonçait, avec la même version, la même couche et la même fréquence |
| **AAC** | **même méthode.** L'en-tête ADTS porte sa propre longueur : trois trames enchaînées, mêmes profil, fréquence et canaux |

### Pourquoi la chaîne de trames, et pas deux octets

`FF Ex` apparaît **par hasard** dans n'importe quel fichier binaire. Un contrôle
qui s'y arrêterait accepterait une image, une archive, du texte. Ce qui prouve,
c'est qu'une trame annonce où finit la suivante — et que la suivante y soit,
trois fois de suite. C'est ce que fait un décodeur pour se synchroniser, **sans
rien décoder**.

**Le débit a le droit de changer d'une trame à l'autre** — c'est le principe du
débit variable, et l'exiger constant refuserait la moitié des MP3 du monde.

**Et MPEG-2 en couche III compte 72 échantillons par trame, pas 144.** L'oublier
décale la trame suivante et casse la chaîne sur un fichier parfaitement valable.

---

## 3. Les formats refusés

Tout le reste. Éprouvé nommément : HTML, SVG, ZIP, texte quelconque, fichier
vide, fichiers de 1, 2, 3 et 7 octets, faux MP3 (une synchro plausible, aucune
trame derrière), faux AAC (même piège).

---

## 4. Le comportement si le format est inconnu

**REFUS.** C'est votre correction à ce que j'avais proposé, et elle était juste :
« laisser passer quand la signature est illisible » aurait gardé une moitié du
défaut.

Le refus arrive **avant** le stockage et **avant** l'appel au fournisseur d'IA.

Le message nomme ce que le téléphone avait annoncé — *« le téléphone a annoncé
audio/webm »* — parce que sans cela, un format que son appareil produit et que
la reconnaissance ignore resterait introuvable.

**Et la marche à suivre est écrite dans le code, pas seulement ici :** si un
format légitime venait à être refusé, **on n'ouvre pas de repli sur
`fichier.type`, on élargit `signature-audio.ts`.**

---

## 5. Le MIME et l'extension finalement rangés

| Format reconnu | Type retenu | Extension |
|---|---|---|
| webm | `audio/webm` | `.webm` |
| mp4 | `audio/mp4` | `.m4a` |
| ogg | `audio/ogg` | `.ogg` |
| wav | `audio/wav` | `.wav` |
| flac | `audio/flac` | `.flac` |
| mp3 | `audio/mpeg` | `.mp3` |
| aac | `audio/aac` | `.aac` |

**C'est le cœur du lot.** Avant, `extensionPour(fichier.type)` déduisait
l'extension de la chaîne du navigateur — et cette extension décide plus tard,
via `typeDepuisCle`, du `Content-Type` qu'Atlas annonce. Le téléphone commandait
donc, indirectement, ce qu'Atlas dirait plus tard. **`extensionPour` est morte**,
avec son repli `.audio` que `typeDepuisCle` ne connaissait pas.

Deux contrôles tiennent l'accord avec le reste du dépôt : chaque type rangé
figure dans la liste blanche de l'application, et chaque extension rangée est
connue de la route qui sert les fichiers.

---

## 6. Les quatre chemins couverts

| Chemin | Route / action |
|---|---|
| Note vocale par URL | `POST /api/notes-vocales/[chantierId]` |
| Complément de note vocale | `completerNoteVocaleAction` |
| Coordonnées dictées | `dicterCoordonneesAction` |
| Retouches dictées | `dicterRetouchesAction` |

Tous passent par `preparerAudioEntrant` (`src/server/audio-entrant.ts`) :

```
taille (sans lire un octet)
  → lecture, une seule fois
  → refus si vide, avec sa phrase à lui
  → FORMAT lu dans les octets
  → type et extension choisis par le SERVEUR
  → stockage ou transcription
```

**Trois contrôles structurels empêchent qu'un cinquième chemin refasse sa propre
cuisine** — la leçon de M3, où cinq chemins d'image devaient traverser une porte
unique : chaque chemin emploie la porte, aucun ne lit les octets en dehors
d'elle, et personne ne déduit plus une extension d'un type MIME.

---

## 7. L'IA n'est jamais appelée avant la validation

Éprouvé en base, à travers le service réel : cinq fichiers hostiles, cinq refus,
**aucune note écrite** et aucun appel de transcription. Les deux chemins qui ne
stockent pas — coordonnées et retouches — refusent également avant le
fournisseur : c'est une facture qui ne part plus.

---

## 8. Les tests, rouges avant, verts après

| Suite | Contrôles | Sur l'ancien comportement |
|---|---|---|
| `test-signature-audio.ts` | **31** | **5 rouges** |
| `test-audio-entrant-db.ts` | **9** | **8 rouges** |
| `test-upload-limits.ts` | 9 | 1 rouge — *et il avait tort* |

**Les tests ont été écrits AVANT la fonction**, dans l'ordre demandé : la
première exécution a échoué sur « module introuvable ».

**La moitié qui protège du remède compte autant que l'autre :** refuser tout est
facile ; ce qui est difficile, c'est de refuser les hostiles sans refuser une
dictée de chantier. Neuf témoins de formats réels passent.

### La meilleure preuve disponible sur cette machine

`test-anneau-dictee-e2e.ts` enregistre avec **le vrai MediaRecorder de
Chromium**, micro simulé, et POSTe le résultat. Un WebM produit par un vrai
navigateur traverse la porte. Ce n'est pas un témoin fabriqué.

### Le contrôle de taille avait tort, et il a été corrigé

`test-upload-limits.ts` exigeait qu'un tampon de zéros annoncé `audio/webm` soit
accepté — **c'est-à-dire le défaut lui-même**. Ce n'est pas une régression du
produit : c'est la prémisse du contrôle qui était fausse. Il porte désormais un
vrai WebM. Exactement la leçon des photos au lot 2B, un lot plus tard.

---

## 9. La batterie

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ 0 erreur, 12 avertissements préexistants |
| Construction | ✅ |
| `npm run verifier:memoire` | ✅ |
| Suites base — RLS comprises | ✅ **234 / 234** |
| Suites navigateur | ✅ **110 / 110** |
| `npm run verifier:connexion` | ✅ |
| `npm audit` | 4 modérées, `drizzle-kit → esbuild`, dépendance de développement |

### Revue hostile du diff

- **aucun fichier** de M9, M10, M11, de la CSP, du RGPD, de `/catalogue`, des
  sauvegardes, de `session.maxAge` ou de `next-auth` n'a été touché ;
- **aucun chemin audio** ne lit les octets hors de la porte ;
- **`fichier.type` ne décide plus nulle part** côté serveur — il ne sert qu'au
  message de refus ;
- les `|| "audio/webm"` qui restent sont **côté navigateur**, dans le
  magnétophone : ils composent le type que le navigateur envoie, et le serveur
  ne l'écoute plus.

---

## 10. Les limites restantes, dites franchement

**1. ~~Aucun iPhone n'a été essayé~~ — LEVÉE le 26 août 2026.** L'essai réel a
eu lieu sur son iPhone, dans Safari, sur son banc : l'enregistrement est passé,
la note a été traitée, et le parcours est allé jusqu'à la génération des
informations du devis.

*Ce qui reste vrai, et qu'il ne faut pas oublier :* cette machine n'a toujours ni
iPhone ni Safari. Le témoin MP4 des suites reste une reproduction de la
spécification. **C'est un essai humain qui a levé la réserve, pas un test
automatique** — et un futur changement de la reconnaissance demandera le même
essai.

**2. Reconnaître n'est pas garantir qu'un son se décode.** Un enregistrement
coupé garde son en-tête et reste reconnaissable. S'il porte du son, c'est la
transcription qui le dira. Le promettre serait mentir.

**3. Un fichier reconnu peut toujours être du remplissage.** Un vrai en-tête
WebM suivi de 15 Mo de zéros est accepté — c'est un vrai WebM, vide. La borne de
taille et la cadence restent les seules défenses sur ce point, et elles
suffisaient déjà : ce lot ferme la fausse déclaration de format, pas l'abus de
volume.

**4. MP3 et AAC restent les plus fragiles**, par nature : ils n'ont pas de
signature. Trois trames enchaînées rendent un faux positif très improbable, pas
impossible.

**5. Un enregistrement très court** — moins de trois trames MP3, soit environ
un dixième de seconde — serait refusé. Aucune dictée réelle n'est aussi courte,
et un enregistrement de cette longueur ne porte de toute façon aucune parole.

---

## Ce qui reste ouvert

| | Pour qui |
|---|---|
| **Fusionner sur `main`** | vous — rien n'est fusionné |
| ~~Essayer une vraie dictée d'iPhone~~ | **fait le 26 août 2026 — réussi** |
| **La QUALITÉ de ce qui sort de la dictée** | lot séparé : prestations, quantités, unités, prix historiques |
| **F7** — l'écran RGPD | décision produit |
| **F10** — le lot CSP | développement, lot à soi |
| **`/catalogue`** | attend les rôles Salarié / Commercial |
| **`ATLAS_PROXY_SAUTS`** | hébergement |
| **Sauvegardes** | toujours aucune — le point le plus grave du dépôt |
