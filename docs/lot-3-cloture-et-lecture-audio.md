# Atlas — Lot 3 : clôture F1–F13, puis lecture du lot Audio

*26 août 2026 · branche `claude/atlas-securite-lot3` · **pas fusionné sur `main`***

**Aucune ligne de code Audio n'a été écrite.** Ce document est une lecture.

---

## 1. Correction du test calendaire

### Ce qui était démontré avant de toucher quoi que ce soit

Le contrôle lisait les jours « regardables » du **mois affiché**, qui s'ouvre au
1er. Ses premiers jours sont derrière nous, le délai minimal en écarte trois de
plus, et les week-ends ne se proposent pas.

Rejoué hors navigateur sur **les 365 jours de 2026** :

```
Jours où le contrôle rougit : 57 / 365
2026-01-27 → 1    2026-01-28 → 0    2026-01-29 → 0    2026-01-30 → 0 …
2026-08-26 → 1    2026-08-27 → 1    2026-08-28 → 1    2026-08-29 → 0 …
```

Toujours les derniers jours du mois, jusqu'à **six d'affilée** en août. Le
26 août — jour de la batterie — en fait partie. Un contrôle qui rougit un jour
sur six sans que rien ne soit cassé est pire qu'absent : on apprend à ignorer
son rouge, et le vrai passe avec.

### Le remède

`scripts/_calendrier-e2e.ts` — il **tourne la page du mois** quand celui-ci est
trop entamé, jusqu'à trois mois, et nomme la navigation si elle est bornée.

**Une seule implémentation, et c'est le sujet.**
`test-deux-dates-calendrier-e2e.ts` portait déjà ce tour de page sous le nom
`troisJoursAuMoins()` ; `test-envoi-client-e2e.ts` ne l'avait pas, et c'est elle
qui rougissait. Le recopier aurait fait une troisième version de la même règle
(`CLAUDE.md` §3). Les deux suites appellent désormais la même pièce, et le
plancher vient de `DELAI_MINIMAL_JOURS` au lieu d'un `3` écrit à la main dans
chacune.

### La règle métier est inchangée — vérifié, pas affirmé

Le diff ne retire que des **préconditions** (« assez de jours au calendrier ») ;
il n'ajoute, ne retire ni n'affaiblit aucune assertion métier :

```
- assert.ok(total >= 3,          `pas assez de jours libres au calendrier`)
- assert.ok(aRetenir.length >= 2, `pas assez de jours acceptables`)
- assert.ok(libres.length >= 2,   `pas assez de jours libres au calendrier`)
```

Et la pièce commune échoue **plus durement** qu'elles : trois mois consultés
sans trouver, et le message accuse la navigation plutôt que le calendrier.
« Jamais plus de deux dates proposées » reste éprouvé à l'identique.

### Les cas demandés, éprouvés sur 730 jours

| | |
|---|---|
| Jours éprouvés | **730** — 2026 et 2027, changements d'année compris |
| Rouges sans le remède | 114 |
| Verts avec | **730 / 730** |
| Tours de page nécessaires | jamais plus de **1** |

Le passage d'année, montré à part :

```
2026-12-29 → plancher 2027-01-01 · décembre offre 0, janvier 2027 offre 21
2026-12-31 → plancher 2027-01-03 · décembre offre 0, janvier 2027 offre 20
```

---

## 2. Batterie complète

Jouée sur l'état exact destiné à la fusion.

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ 0 erreur, 12 avertissements préexistants |
| Construction | ✅ |
| `npm run verifier:memoire` | ✅ 8 fichiers |
| Suites base — RLS comprises | ✅ **232 / 232** |
| Suites navigateur | ✅ **110 / 110** |
| `npm run verifier:connexion` | ✅ connexion réelle derrière une origine étrangère |
| `npm audit` | 4 modérées, `drizzle-kit → esbuild`, **dépendance de développement** |

### Pourquoi 110 et non 111

**Un faux vert trouvé dans la batterie elle-même**, et corrigé plutôt que gardé.
`_creer-chantier-e2e.ts` et `_calendrier-e2e.ts` n'exportent que des fonctions :
joués seuls, ils n'affichent rien et sortent en succès. Le lanceur les comptait
donc comme **deux suites réussies**. Il annonçait 112/112 là où 110 seulement
mesurent quelque chose — et le premier des deux traînait là depuis longtemps.

C'est le contrôle qui mesure zéro de `CLAUDE.md` §5 : il ne dit pas « rouge », il
ne dit rien, et il gonfle le chiffre auquel on se fie. **Le chiffre baisse, et
c'est le bon.**

*À noter, parce que c'est le genre de chose qu'on se cache :* ma première
correction n'a pas pris — les deux filtres avaient été insérés au même endroit.
Vu parce que le chiffre n'avait pas bougé, non parce qu'un contrôle l'a dit.

### Trois suites rouges à un tour intermédiaire — classées, pas masquées

| Tour | Rouges | Rejeu seule |
|---|---|---|
| n° 4 | `fiche-chantier`, `note-hors-documents`, `planning` | les trois **vertes** |
| n° 1 | `anneau-dictee`, `arrosage` | les deux **vertes** |

**Classification : faux rouge du contrôle** (catégorie 3), et voici ce qui la
fonde plutôt qu'un « c'est un flake » :

- suites **différentes** à chaque tour, sur un code identique ;
- **aucune erreur serveur** dans le journal des tours rouges, mémoire libre,
  PostgreSQL debout ;
- les **mêmes 110 suites sont passées ensemble trois fois**, dont le tour final ;
- deux des trois échouent sur le même symptôme — `feuille/pdf` → **404**, ce que
  cette route rend quand le devis n'a pas encore de ligne — et la troisième sur
  « rallumer n'est pas arrivé en base ». Trois fois « l'état n'a pas atteint la
  base avant qu'on le relise ».

**Rien n'a été masqué** : aucun délai allongé, aucune assertion affaiblie, aucune
exclusion. Le remède — remplacer l'attente par un signal — est écrit dans
`TODO.md` avec sa raison.

---

## 3. Verdict F1–F13

Revue de dernière minute : depuis la clôture (`a798770`), **aucun fichier du
diff F1–F13 n'a été retouché**, et **aucun fichier de M9/M10/M11** non plus. Les
huit contrôles F sont verts.

# F1–F13 : **CLOS**

- **F7** — décision produit / RGPD
- **F10** — lot CSP séparé

---

# LOT AUDIO — LECTURE

## 4. Tous les chemins par lesquels un audio entre

| Entrée | Route / action | Auth | Taille | Type déclaré | Extension | Contenu vérifié ? | Stocké ? | Envoyé à une IA ? | Servi ensuite ? |
|---|---|---|---|---|---|---|---|---|---|
| **Note vocale** (anneau, écran de dictée) | `POST /api/notes-vocales/[chantierId]` → `recevoirNoteVocale` | `getCurrentCtx` | 15 Mo fichier + flux borné à 16 Mo | `verifierTypeAudio` (liste blanche) | posée par le **serveur** | **NON** | **OUI** | **OUI** (relu du stockage) | **OUI** (`/api/fichiers/…`) |
| **Note vocale** (même service, autre porte) | action `completerNoteVocaleAction` | `getCurrentCtx` | 15 Mo | `verifierTypeAudio` | posée par le serveur | **NON** | **OUI** | **OUI** | **OUI** |
| **Coordonnées dictées** (nouveau chantier) | action `dicterCoordonneesAction` | `getCurrentCtx` | 15 Mo | `verifierTypeAudio` | — | **NON** | **NON** | **OUI** | non |
| **Retouches dictées** (devis complet) | action `dicterRetouchesAction` | `getCurrentCtx` | 15 Mo | `verifierTypeAudio` | — | **NON** | **NON** | **OUI** | non |
| **Export RGPD** | `GET /api/mes-donnees` | `getCurrentCtx` | — | — | — | — | relit le stocké | non | **OUI**, dans un zip |

**Aucun chemin audio n'échappe au mécanisme commun.** Les quatre entrées passent
toutes par `verifierTailleFichier` puis `verifierTypeAudio`, et les quatre posent
la cadence `LIMITES.televersementFichier`.

**Route Handler contre Server Action — la seule différence est en amont**, et
elle est en faveur de la route : elle borne le flux **pendant la lecture**
(`formDataBornee`, constat M6), là où les actions s'en remettent à
`serverActions.bodySizeLimit`. La règle métier, elle, est identique : les deux
appellent le même service.

---

## 5. La propriété de sécurité aujourd'hui GARANTIE

1. **Rien n'entre sans session** — `getCurrentCtx` sur les quatre chemins.
2. **Rien ne dépasse 15 Mo**, et sur la route, la borne tient *pendant* la
   lecture — un `content-length` menteur ou un `Transfer-Encoding: chunked` ne
   la contourne pas.
3. **Le type SERVI ne vient jamais du navigateur.** `typeDepuisCle` le dérive de
   l'extension que **le serveur** a posée, et sa table ne peut rendre ni
   `text/html` ni `image/svg+xml` — au pire `application/octet-stream`
   (constat M1).
4. **`X-Content-Type-Options: nosniff`** est posé sur `/(.*)`, donc y compris
   sur `/api/fichiers/…`.
5. **Le fichier n'est lisible que par son entreprise** — la route de service
   vérifie l'appartenance avant de rendre un octet, et répond 404 sinon.
6. **L'audio transcrit est purgé** (`audios_a_purger`).
7. **Un enregistrement vide est refusé** plutôt que rangé.

## 6. La propriété qui MANQUE réellement

**Le contenu n'est jamais confronté au type annoncé.** `verifierTypeAudio` ne
lit que la chaîne envoyée par le navigateur ; aucun octet du fichier n'est
regardé. Un fichier quelconque annoncé `audio/webm` est donc **accepté, rangé,
et envoyé au fournisseur de transcription**.

**Et il y a pire que le type : l'extension et le MIME rangé sortent tous deux de
cette chaîne non vérifiée.** `extensionPour(mimeType)` choisit `.webm`, `.m4a`…
d'après elle, et c'est cette extension qui décidera plus tard du
`Content-Type` servi. La chaîne du navigateur commande donc, indirectement,
**ce qu'Atlas annoncera plus tard au navigateur** — sur une liste fermée, mais
elle commande.

## 7. Scénarios — exploitables et non exploitables

### Non exploitables, et il faut le dire

| Scénario | Pourquoi il ne mène nulle part |
|---|---|
| **Faux `audio/webm` contenant du HTML** | servi en `audio/webm` (dérivé de l'extension serveur), avec `nosniff`. Le navigateur ne l'interprétera pas |
| **Polyglotte HTML/audio** | même raison : rien ne le sert en `text/html` |
| **SVG renommé** | `typeDepuisCle` ne rend jamais `image/svg+xml` pour une extension audio |
| **Discordance MIME / extension** | l'extension n'est pas celle du client : le serveur la compose |
| **Fichier énorme** | 15 Mo, et la borne tient pendant la lecture (M6) |
| **Chemin audio oublié** | aucun : les quatre passent par le mécanisme commun |
| **Exécution chez un autre utilisateur** | la route de service refuse hors entreprise |

**Je n'ai pas de chemin d'exécution ni de fuite à montrer.** Le dire est un
choix : qualifier ce défaut de « critique » sans démonstration ferait ignorer la
prochaine alerte qui, elle, le sera.

### Réellement exploitables, et modestement

| Scénario | Ce qu'il coûte |
|---|---|
| **Stockage détourné** | 15 Mo de n'importe quoi par envoi, rangés dans le stockage du patron sous une extension audio. Borné par la cadence, mais rien ne le refuse |
| **Fichier tronqué ou non-audio envoyé au fournisseur d'IA** | Atlas **paie** un appel de transcription pour un fichier qui n'en est pas un, et rend « transcription impossible ». C'est une facture, pas une fuite |
| **Zip d'export pollué** | le faux fichier ressort dans `/api/mes-donnees`, sous une extension qui ment sur son contenu |

**Gravité honnête : FAIBLE.** Ce n'est pas une porte d'exécution ; c'est une
porte d'**abus de ressource**, et la seule qui reste ouverte sur les fichiers
depuis que les images ont été fermées (M2/M3).

## 8. Les formats réellement nécessaires

Relevé dans le code, pas supposé. `src/app/chantiers/[id]/magnetophone.ts` fait
`new MediaRecorder(stream)` **sans imposer de type**, puis rend
`recorder.mimeType || "audio/webm"`. Ce que le navigateur choisit fait donc foi :

| Appareil | Ce que le magnétophone produit |
|---|---|
| **Safari / iPhone** | `audio/mp4` — conteneur ISO-BMFF |
| **Chrome / Android, PC** | `audio/webm;codecs=opus` — conteneur Matroska |
| **Firefox** | `audio/ogg;codecs=opus` |

Plus ce qu'un artisan **importe** depuis son téléphone, que `ACCEPT_AUDIO` offre
déjà : `m4a`, `mp3`, `wav`, `aac`, `flac`.

**Les cinq conteneurs à reconnaître, et leur signature :**

| Format | Octets | Fiabilité |
|---|---|---|
| **WebM / Matroska** | `1A 45 DF A3` en tête | sûre, 4 octets |
| **MP4 / M4A** | `ftyp` aux octets 4-7 | sûre — la taille de boîte précède |
| **OGG** | `OggS` en tête | sûre |
| **WAV** | `RIFF` + `WAVE` aux octets 8-11 | sûre |
| **MP3** | `ID3`, **ou** `FF Ex/Fx` | **la seule fragile** : une trame MP3 nue n'a pas d'en-tête stable, et un fichier peut commencer par des octets de bourrage |
| **FLAC** | `fLaC` | sûre |
| **AAC brut (ADTS)** | `FF F1` / `FF F9` | fragile, comme MP3 |

## 9. La solution minimale que je recommande

**Une fonction pure dans `src/lib/`, sans aucune bibliothèque** — et le
précédent est dans le dépôt : `src/lib/exif.ts` vérifie déjà des signatures
d'images en TypeScript nu, et refuse un SVG annoncé `image/jpeg`. *Le prompt
demandait de ne pas ajouter de bibliothèque native lourde : la question ne se
pose pas, il ne faut aucune bibliothèque.*

```
signatureAudio(octets: Uint8Array): "webm" | "mp4" | "ogg" | "wav" | "flac"
                                  | "mp3" | "aac" | null
```

Puis, aux quatre entrées : **le type déclaré doit s'accorder à la signature.**
Et — c'est le point qui compte le plus — **l'extension et le MIME rangés doivent
sortir de la SIGNATURE, jamais de la chaîne du navigateur.**

**Ce qu'il ne faut surtout pas faire, et pourquoi :**

- **aucun parseur de conteneur.** Lire un Matroska, c'est écrire un analyseur de
  format binaire sur une entrée hostile — on remplacerait un abus de ressource
  par une vraie surface d'attaque. Le remède serait pire que le mal ;
- **ne pas refuser sur MP3/AAC quand la signature est muette.** Ces deux-là
  n'ont pas d'en-tête fiable. La règle sûre est : *une signature CONNUE qui
  contredit le type annoncé refuse ; une signature illisible laisse passer avec
  le type déclaré*. Refuser dans le doute ferait perdre des dictées de chantier.

## 10. Les tests à écrire AVANT le correctif

1. **Chaque format réel est reconnu** — un échantillon minimal de chaque
   conteneur, fabriqué dans le test, jamais téléchargé.
2. **La moitié qui protège du remède, et elle compte autant :** un vrai
   `audio/mp4` d'iPhone et un vrai `audio/webm` d'Android **passent**. Sans
   elle, un correctif trop strict serait vert et casserait le chantier.
3. **Un faux `audio/webm` portant du HTML est refusé**, et le message nomme le
   vrai format vu.
4. **Un MP3 sans en-tête `ID3` passe** — le cas fragile, explicitement toléré.
5. **Un fichier tronqué à trois octets ne fait pas lever** la fonction.
6. **L'extension rangée suit la signature**, pas le type déclaré : envoyer un
   OGG annoncé `audio/webm` doit ranger un `.ogg`.
7. **Les quatre chemins appellent le contrôle** — contrôle structurel, comme
   celui des images de M3, sinon le cinquième ne l'appellera pas.
8. **Aucun octet n'est lu avant la borne de taille** — l'ordre des gardes.

## 11. Risques de régression — iPhone / Safari d'abord

| Risque | Pourquoi il est réel |
|---|---|
| **iPhone refusé** | Safari annonce `audio/mp4` et écrit un ISO-BMFF ; la signature `ftyp` est à l'octet **4**, pas 0. Une vérification écrite « en tête » refuserait **toutes** les dictées d'iPhone |
| **`audio/m4a` et `audio/x-m4a`** | deux types déclarés pour un même conteneur `mp4` : la correspondance doit accepter les trois |
| **MP3 importé** | sans `ID3`, la signature est muette : refuser casserait un import légitime |
| **Enregistrement en cours coupé** | un WebM tronqué garde sa signature — il doit continuer à passer, la transcription dira le reste |
| **Ce qui ne peut PAS être éprouvé ici** | il n'y a ni iPhone ni Safari sur ce poste. Les échantillons des tests seront fabriqués ; **la vérification finale se fait sur son espace**, avec une vraie dictée. À dire, pas à supposer |

## 12. Défaut trouvé hors périmètre

**`extensionPour()` rend `.audio` quand le type ne correspond à rien de connu.**
Ce cas est aujourd'hui inatteignable — `verifierTypeAudio` a déjà refusé —, mais
la fonction ne le sait pas. `typeDepuisCle` ne connaît pas `.audio` : un tel
fichier serait servi en `application/octet-stream`. **Sans danger, et à
supprimer** quand la signature commandera l'extension : un repli qui ne peut
plus être atteint est un piège pour la prochaine lecture.

*Aucun autre défaut de sécurité n'a été trouvé hors périmètre pendant cette
lecture.*

---

## Ce qui reste ouvert, et pour qui

| | Pour qui |
|---|---|
| **Fusionner sur `main`** | le patron — rien n'est fusionné, comme demandé |
| **F7** — l'écran RGPD | décision du patron |
| **F10** — le lot CSP avec `nonce` | développement, lot à soi |
| **`/catalogue`** sans garde de rôle | décision du patron, quand les droits Salarié / Commercial seront définis |
| **`ATLAS_PROXY_SAUTS`** | hébergement |
| **Trois suites qui rougissent sous la batterie** | développement — remède écrit dans `TODO.md` |
| **Le lot Audio lui-même** | attend votre feu vert : **aucune ligne n'a été écrite** |
