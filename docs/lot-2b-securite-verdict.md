# Atlas — Lot 2B : fermeture de M3 et M6

**Document destiné à ChatGPT**, en réponse à son brief « Lot 2B : fermeture
définitive de M3 et M6 ». 24 août 2026.

**Périmètre tenu :** M3 et M6 seulement. M1/M2/M4/M5 n'ont été touchés que là où
M3 l'imposait (les chemins d'image passent désormais par une porte unique). Le
Lot 3 n'est pas commencé.

**Les deux points sont fondés, et le second l'est contre ma propre correction du
matin.** Le détail est ci-dessous, avec ce qui a été constaté plutôt que
supposé.

---

## M3 — La suppression des métadonnées est désormais garantie

### Ancien comportement

Quatre chemins d'image faisaient chacun leur cuisine. Trois d'entre eux se
terminaient par un « on range quand même » :

```ts
const nettoye = retirerMetadonnees(brut, fichier.type);
if (!nettoye.nettoye) logger.info("rangée sans nettoyage des métadonnées");
const octets = Buffer.from(nettoye.octets);   // ← l'original
```

Et la liste serveur acceptait `image/heic` / `image/heif`, que le nettoyage ne
sait pas lire. **Un HEIC était donc rangé avec ses coordonnées GPS**, par
construction et non par accident.

La protection reposait sur l'attribut `accept` des écrans, qui fait transcoder
iOS en JPEG. **Le brief a raison : c'est de l'UX, pas une frontière.** Qui poste
directement au serveur ne regarde aucun attribut d'écran.

### Le recensement demandé — cinq chemins, pas quatre

| Chemin | Fichier | État avant |
|---|---|---|
| Photos de chantier | `src/app/chantiers/[id]/photos-actions.ts` | rangeait l'original en cas d'échec |
| Tickets de TVA | `src/app/termines/tva/actions.ts` | idem |
| Diagnostic végétal | `src/app/paysage/diagnostic/actions.ts` | **faisait déjà tout bien** — c'est le modèle repris |
| Croquis d'arrosage | `src/app/paysage/arrosage/actions.ts` | aucun nettoyage : il **envoie** à un fournisseur de vision |
| **Logo d'entreprise** | `src/app/reglages/documents/actions.ts` | **aucun nettoyage — et il part le plus loin** |

**Le logo n'était dans aucun brief, et c'est l'exposition la plus grave des
cinq.** Un artisan choisit souvent son enseigne photographiée au téléphone. Ce
fichier est **embarqué dans chaque devis et chaque facture** envoyés aux
clients : les coordonnées GPS voyageaient chez des tiers, indéfiniment.

Chemins vérifiés et **hors périmètre** parce qu'ils ne portent pas d'image :
dictée de note vocale, dictée de retouches de devis, dictée de coordonnées
(tous `verifierTypeAudio`), et import de tarifs (XLSX/CSV/PDF).

### Correction

Une **porte unique** : `src/server/photo-entrante.ts`.

```
taille → format (liste blanche) → nettoyage → REFUS si le nettoyage échoue
```

Rien ne sort d'elle que des octets nettoyés. Les cinq chemins l'appellent, et
aucun ne lit plus les octets bruts lui-même.

**Choix HEIC : solution B — refus côté serveur.** Raisons :

1. la solution A demanderait un décodeur natif (libheif) qui analyserait un
   fichier hostile en C — **plus de surface d'attaque que ce qu'on referme**, et
   le brief l'exclut explicitement ;
2. le refus est **rare en pratique** : `accept` fait transcoder les iPhone. Il
   ne se déclenche que lorsque le garde-fou d'UX n'a pas joué — c'est-à-dire
   exactement quand une protection réelle est nécessaire ;
3. **le refus donne le geste**, pas seulement le verdict :

> Votre iPhone a envoyé cette photo au format HEIC, dont Atlas ne sait pas
> retirer les données de localisation. Sur votre téléphone : Réglages ›
> Appareil photo › Formats › « Le plus compatible ». Reprenez ensuite la photo.

### Un bénéfice non cherché : la validation du contenu réel

`retirerMetadonnees` vérifie la **signature** du fichier avant de le découper.
Refuser sur échec de nettoyage refuse donc aussi tout fichier maquillé — un SVG
annoncé `image/jpeg`, le vecteur du constat M2. Le type déclaré par le
navigateur ne sert plus qu'à choisir quel nettoyeur essayer.

### Ce que cela revient sur, et le coût assumé

Le matin même, ce dépôt écrivait la règle inverse : *« un échec de nettoyage ne
refuse JAMAIS la photo »*, au nom d'un principe du patron — un outil qui refuse
la photo qu'on vient de prendre est pire que le risque qu'il évite.

**Ce principe protégeait le geste de l'artisan et sacrifiait la donnée de son
client.** Le patron a tranché : *« on maximise la sécurité »*. Le coût est réel
et borné : un téléphone qui envoie un HEIC brut lit un refus — avec le réglage
qui le supprime définitivement.

### Fichiers

`src/server/photo-entrante.ts` (neuf) · `src/lib/exif.ts` ·
`photos-actions.ts` · `termines/tva/actions.ts` · `paysage/diagnostic/actions.ts` ·
`paysage/arrosage/actions.ts` · `reglages/documents/actions.ts` ·
`scripts/_images-temoins.ts` (neuf) · `scripts/test-photo-entrante.ts` (neuf) ·
`scripts/test-photos-acceptees.ts`

### Preuves — `scripts/test-photo-entrante.ts`, 15 vérifications

| Exigence du brief | Vérification |
|---|---|
| JPEG valide nettoyé → accepté | ✅ et le témoin GPS a disparu des octets rendus |
| PNG valide → accepté | ✅ idem |
| WebP valide → accepté | ✅ idem |
| métadonnée identifiable → absente après traitement | ✅ témoin `GPS_DU_DOMICILE_DU_CLIENT` cherché dans les octets |
| nettoyage en échec → aucun stockage | ✅ la porte ne rend **aucun octet** ; il n'y a rien à ranger |
| nettoyage en échec avant IA → aucun appel au fournisseur | ✅ preuve structurelle : aucun chemin n'appelle `lireCroquis`/`lireTicket` autrement que sur `prete.photo` |
| HEIC/HEIF brut → refusé | ✅ quatre variantes, casse comprise |
| aucun chemin ne conserve silencieusement l'original | ✅ **trois contrôles structurels** sur les cinq fichiers |

Les trois contrôles structurels — c'est la moitié qui manquait au lot 2 :

- chaque chemin **appelle** `preparerPhotoEntrante` ;
- aucun n'appelle `retirerMetadonnees` ni `photoAcceptee` lui-même ;
- **aucun n'appelle `.arrayBuffer()`** — seule la porte a le droit de lire les
  octets bruts d'une image.

**Vus rouges.** En remettant à la main la version d'avant sur les tickets de
TVA : les trois contrôles rougissent, chacun avec son motif. En remettant le
HEIC dans la liste serveur : deux autres rougissent.

### Limites, dites franchement

- **Les images restent des images.** Une plaque d'immatriculation ou un visage
  au second plan y sont toujours. C'est la conservation limitée qui répond à
  cela, pas ce lot.
- **Le nettoyage est sans réencodage.** Il retire les blocs de métadonnées
  connus (EXIF, XMP, IPTC, commentaires) et recopie les octets d'image. Une
  donnée cachée dans un endroit non standard d'un format valide survivrait.
  Réencoder demanderait une bibliothèque d'images — la dépendance que le brief
  demande d'éviter, et qu'on évite pour la même raison qu'en A.
- **Un fichier tronqué se nettoie et passe.** Éprouvé : aucune métadonnée n'en
  ressort à aucune troncature. Le refuser reviendrait à refuser une photo dont
  l'envoi a été coupé.

---

## M6 — Une borne réelle pendant la lecture du corps

### Ancien comportement

```ts
const annonce = Number(requete.headers.get("content-length") ?? "");
if (annonce > LIMITE) return 413;
const formData = await requete.formData();   // ← non borné
```

**Le brief a raison, et contre ma propre correction du matin.** `content-length`
est écrit par le client. Le sous-déclarer — ou employer
`Transfer-Encoding: chunked`, qui n'en porte aucun — laissait `formData()`
avaler ce qu'on voulait, `fichier.size` n'étant consulté qu'après.

### Étape 1 — ce que la pile fait vraiment (constaté, pas supposé)

| Question | Réponse | Source |
|---|---|---|
| `serverActions.bodySizeLimit` couvre-t-il les Route Handlers ? | **Non** | doc de Next : « the maximum size of the request body sent to a **Server Action** » |
| Une limite native existe-t-elle pour les Route Handlers ? | **Non** | la doc précise même : « unlike API Routes […] you do not need to use `bodyParser` » — il n'y a aucune configuration |
| Où le multipart est-il décodé ? | dans `request.formData()`, donc dans `undici`, **après** consommation du corps | lecture du code |
| `request.body` peut-il être lu avec une borne stricte ? | **Oui** | sonde exécutée : flux borné → `formData()` refuse au-delà, accepte en dessous |
| Combien de routes lisent un corps ? | **une seule** (`/api/notes-vocales/[chantierId]`) ; l'autre route POST (`cron/purge-fichiers`) n'en lit aucun | balayage de `src/app/api` |

### Correction

`src/server/corps-borne.ts` :

```ts
formDataBornee(requete, limite)
  → refus rapide sur content-length (premier rempart, plus le seul)
  → request.body traverse un TransformStream qui COMPTE et CASSE le flux
  → formData() parse le flux borné
```

**Le flux est cassé, pas tronqué.** Tronquer rendrait un multipart amputé que le
parseur lirait comme un fichier valide mais incomplet — un fichier corrompu
rangé en silence.

**Pas de double copie géante :** on ne rassemble pas le corps pour le mesurer
puis le re-parser. On borne **en passant** ; le parseur travaille sur le flux
borné. Au pire, la limite plus le morceau en cours transitent.

Un déballage de cause est nécessaire : `undici` emballe l'erreur du flux dans un
`TypeError`. Sans lui, un corps trop gros se présenterait comme un multipart
malformé — une erreur qui accuse le mauvais coupable.

### Fichiers

`src/server/corps-borne.ts` (neuf) ·
`src/app/api/notes-vocales/[chantierId]/route.ts` ·
`scripts/test-corps-borne.ts` (neuf)

### Preuves — `scripts/test-corps-borne.ts`, 9 vérifications

| Exigence du brief | Vérification |
|---|---|
| requête normale sous la limite | ✅ et le fichier ressort entier, à l'octet |
| `content-length` supérieur → refus avant lecture | ✅ |
| **corps trop gros avec longueur sous-déclarée** | ✅ annoncé 1 000 o, envoyé 200 ko → refusé **par le flux** |
| **corps trop gros sans longueur exploitable** | ✅ en-tête absent (cas `chunked`) → refusé par le flux |
| multipart malformé | ✅ et il ne se fait **pas** passer pour un dépassement |
| fichier exactement à la limite | ✅ accepté |
| fichier juste au-dessus | ✅ refusé |
| la route fonctionne pour une vraie note vocale | ✅ suites navigateur (dictée de bout en bout) |

**Preuve directe de la propriété :** un cas compte les octets qui sortent
réellement de `fluxBorne` quand on lui donne un corps **dix fois** trop gros —
et vérifie qu'ils ne dépassent jamais la limite.

**Vus rouges.** En remettant `return requete.formData()` à la place de la borne :
les deux cas décisifs (longueur sous-déclarée, longueur absente) rougissent.

### Limites, dites franchement

**Ce que cette suite ne peut pas prouver :** ce que Node met en tampon *avant*
de rendre la main à Next — cela dépend du serveur HTTP et de l'hébergeur, pas de
notre code. Notre garantie commence à l'objet `Request`, et c'est là que la
borne est posée. Une protection en amont (limite du reverse-proxy) reste
souhaitable le jour du déploiement, et ne remplace pas celle-ci.

---

## Tableau transversal des téléversements

Chaque case dit **la protection réelle**, pas « oui ».

| Entrée | Auth | Taille bornée **avant lecture** | Taille fichier | Type réel | EXIF / GPS | Cadence | Stockage sûr | Accès isolé |
|---|---|---|---|---|---|---|---|---|
| **Photos de chantier** | `getCurrentCtx` | `bodySizeLimit` 15 Mo (action serveur) | `fichier.size` avant `arrayBuffer` | **signature vérifiée** par le nettoyeur | **retirés, sinon refus** | 20/min/entreprise | clé `uuid` posée par le serveur, chemin résolu et borné | `/api/fichiers` : session + `withEntreprise` + type dérivé de la clé |
| **Tickets de TVA** | `getCurrentCtx` | idem | idem | idem | **retirés, sinon refus** | 20/min/entreprise | idem | **non servi du tout** — la clé vit sur `achats_tva` (RLS) et `/api/fichiers` ne la connaît pas |
| **Diagnostic végétal** | `getCurrentCtx` | idem | idem | idem | **retirés, sinon refus** | 10/min (borne une facture d'IA) | idem | relu **serveur seulement**, jamais par URL |
| **Croquis d'arrosage** | `getCurrentCtx` | idem | **8 Mo**, plus serré | idem | **retirés avant l'envoi au fournisseur** | 10/min | *non stocké* | *non stocké* |
| **Logo d'entreprise** | `getCurrentCtx` + `exigerProprietaire` | idem | 1,5 Mo (`refusDuLogo`) | PNG/JPEG + signature | **retirés, sinon refus** | 20/min/entreprise | idem | `/api/fichiers` : session + `withEntreprise` |
| **Notes vocales — route** | `getCurrentCtx` (dans le service) | **`formDataBornee` : flux coupé** | `fichier.size` | liste blanche audio (type déclaré) | *sans objet* | 20/min/entreprise | idem | `/api/fichiers` : session + `withEntreprise` |
| **Notes vocales — action** | `getCurrentCtx` | `bodySizeLimit` 15 Mo | `fichier.size` | liste blanche audio | *sans objet* | 20/min/entreprise | idem | idem |
| **Dictée de retouches / de coordonnées** | `getCurrentCtx` | `bodySizeLimit` 15 Mo | `fichier.size` | liste blanche audio | *sans objet* | 20/min/entreprise | *non stocké* | *non stocké* |
| **Import XLSX / CSV / PDF** | `getCurrentCtx` + `exigerProprietaire` | `bodySizeLimit` 15 Mo | **5 Mo** | extension + structure ZIP ; **décompression bornée à 32 Mo** | *sans objet* | 20/min/entreprise | *non stocké* | *non stocké* |

### Ce que le tableau révèle, et qui n'est pas fermé

**Le type audio reste le type DÉCLARÉ.** Contrairement aux images, aucune
signature n'est vérifiée pour les dictées : un fichier annoncé `audio/webm` qui
n'en est pas serait rangé, puis servi avec le type déduit de son extension.

**Portée réelle :** l'exécution est fermée par ailleurs — le type servi est
dérivé de la clé (liste blanche, jamais `image/svg+xml` ni `text/html`), et
`nosniff` est posé sur toutes les routes. Ce qui reste possible est de ranger un
fichier inerte sous une extension audio.

**Signalé, non traité** : c'est hors de M3 (aucune métadonnée d'image) et hors de
M6 (aucune question de mémoire), et le brief demande de ne pas ouvrir de
nouveau lot.

---

## Revue hostile du diff

Cherché exactement les cinq défauts nommés dans le brief :

| Cherché | Résultat |
|---|---|
| un chemin qui stockerait encore l'original après échec EXIF | **aucun.** Les 5 `enregistrerObjet` de chemins d'image prennent `prete.photo.octets` ; les autres appels rangent des PDF engendrés ou de l'audio |
| un chemin qui enverrait l'original à l'IA | **aucun.** `lireCroquis` et `lireTicket` prennent `prete.photo` ; le diagnostic relit des images **déjà nettoyées à l'entrée** |
| un HEIC passant silencieusement | **aucun.** Refus explicite avant la liste blanche, quatre variantes éprouvées |
| une route appelant encore `formData()` avant une borne efficace | **aucune.** Balayage de `src/app/api` : deux routes POST, une sans corps, l'autre en `formDataBornee` |
| une protection dépendant uniquement de `content-length` | **aucune.** L'en-tête reste le premier refus ; le flux est la garantie |

**Régressions introduites puis corrigées pendant ce lot :**

1. **La borne à 8 Mo du croquis** avait disparu en passant par la porte
   commune (relâchée à 15 Mo). Rétablie via un paramètre, et **un contrôle la
   garde**.
2. **`nomOriginal` avait disparu** des photos de chantier, ce qui aurait changé
   la description envoyée à l'assistant. Rétabli, et borné à 120 caractères au
   passage.
3. **Un contrôle se piégeait lui-même** : il retirait les lignes commençant par
   `*`, ce qui emporte le `*/` de fermeture d'un bloc — la regex courait alors
   jusqu'au bloc suivant et avalait le vrai code. Il rougissait sur un fichier
   juste.
4. **Deux contrôles réclamaient ce que ce lot retire** (la tolérance HEIC). Ils
   ont été **retournés**, pas contournés, avec la raison écrite dans leur
   commentaire.

---

## Tests exécutés

| | Résultat |
|---|---|
| `test-photo-entrante.ts` (M3, neuf) | 15/15 |
| `test-corps-borne.ts` (M6, neuf) | 9/9 |
| `test-photos-acceptees.ts` (lot 2, adapté) | 14/14 |
| `test-exif-diagnostic.ts` (lot 2) | vert |
| `test-type-de-fichier.ts`, `test-cle-de-stockage.ts`, `test-classeur-bombe.ts` (lot 2) | verts |
| Suites base — isolation, RLS, règles métier (lot 1 compris) | **223/223** |
| Suites navigateur | **110/110** |
| `tsc --noEmit` | 0 erreur |
| `lint` | 0 erreur |
| `verifier:memoire` | cohérente |
| `verifier:connexion` — connexion réelle, dans un navigateur, derrière une origine étrangère | réussie |

---

## Ce que la batterie a coûté, et ce qu'elle a appris

**Il a fallu cinq passages pour l'obtenir au vert, et aucun des rouges ne venait
du lot.** Sept contrôles sont tombés en chemin, tous dans les suites navigateur,
tous verts rejoués seuls, et aucun ne touche une image ni un corps de requête.
Le diff du lot ne touche d'ailleurs aucun des fichiers concernés.

| Ce qui est tombé | La vraie cause |
|---|---|
| `test-date-lointaine-e2e` | le 25 août est le premier jour où la date à six mois tombe un **1er** : l'écran écrit « 1er mars », la suite cherchait « 1 mars ». Elle **redisait la règle d'écriture** au lieu d'employer `jourLisible` |
| `test-deux-dates-calendrier-e2e` | le même jour, il ne reste que **deux** jours ouvrés au mois affiché, quand la suite en exige trois |
| `test-fiche-chantier-e2e` | `waitForTimeout(900)` avant de lire la base : sous charge, l'enregistrement dépasse ce délai |
| `test-fiche-client-e2e` (deux endroits) | `waitForURL` rend la main avant que la page soit rendue : le contrôle lisait « Chargement… » et annonçait le nom manquant. **Il ne mesurait rien du tout** |
| `test-facture-au-client-e2e` | il guettait **un état transitoire** : l'écran passe de « ne l'a pas encore reçue » à « c'est vous qui l'envoyez » quand le lien se prépare |
| `test-ia-02-e2e` | `waitForTimeout(300)` après une action serveur, puis « la prestation a disparu » — et un message réduit à « 0 == 1 » |

**Aucun n'a été contourné, aucun n'a été affaibli.** Les assertions défendent la
même règle qu'avant ; ce qui a changé, c'est ce qu'elles attendent : le signal
réel — la valeur en base, la mention à l'écran, la fin du chargement — au lieu
d'un délai fixe ou d'une formulation parmi deux.

**Pourquoi cela méritait d'être réparé plutôt que constaté.** Un contrôle qui
rougit un jour sur trente, ou selon la charge de la machine, s'apprend à être
ignoré — et l'on perd le garde-fou sans s'en apercevoir. Deux de ces fichiers
portaient déjà, en commentaire, le diagnostic d'un faux rouge antérieur (12 août
2026) : une cause connue et laissée en place se repaie.

---

## Verdict

**LOT 2 VALIDÉ.**

M3 et M6 sont fermés, et fermés par une propriété plutôt que par un correctif
ponctuel :

| | La propriété garantie |
|---|---|
| **M3** | une image d'utilisateur n'est **jamais** rangée ni envoyée à un fournisseur d'IA tant qu'Atlas n'en détient pas une version dont il peut garantir le nettoyage. Une porte unique, cinq chemins, aucun qui lise les octets bruts lui-même |
| **M6** | un client, même authentifié, ne peut pas obliger Atlas à mettre en mémoire un corps arbitrairement grand. Le flux est **cassé en passant**, pas mesuré après coup ; `content-length` reste un premier refus, jamais la garantie |

**Ce qui reste ouvert, et qui est dit plutôt que tu :**

- le **type audio** est encore le type déclaré : aucune signature n'est
  vérifiée pour les dictées. Hors M3 (aucune métadonnée d'image) et hors M6
  (aucune question de mémoire) ; portée réelle limitée par le type servi, qui
  est dérivé de la clé, et par `nosniff`. Consigné dans `TODO.md` ;
- ce qui se passe **avant** `Request` — ce que l'hébergeur met en tampon avant
  de rendre la main à Next — ne dépend pas de ce code, et n'est donc pas
  garanti par lui.

Le Lot 3 n'est pas commencé.
