# Revérifier la visite guidée

`appli/visite-guidee.html` se joue au doigt, de bout en bout, sans serveur ni
base : rien ici ne demande son « oui ».

```bash
node appli/scripts/visite-guidee/parcourir.mjs                 # tout, à 320, 390, 1024 et 1280 points (une dizaine de minutes)
node appli/scripts/visite-guidee/parcourir.mjs --vite          # son écran seulement, 390 × 664
node appli/scripts/visite-guidee/parcourir.mjs --seulement chrono
node appli/scripts/visite-guidee/parcourir.mjs --adresse https://florianmarrins0978-svg.github.io/Atlas-app/visite-guidee.html
```

Il sort en erreur et nomme l'étape dès qu'un contrôle tombe.

| Contrôle | Ce qu'il tient | La remarque qui l'a fait naître |
|---|---|---|
| `visite` | chaque étape mène à la suivante ; la cible n'est jamais sous le guide ni hors de l'écran ; rien ne déborde ; les 19 rubriques des Réglages s'ouvrent et reviennent ; faire défiler replie le guide | « la petite barre noire cache les informations » (21 novembre) |
| `essais` | les boutons à essayer du devis et de la facture s'enchaînent sans Retour ; Suivant fait avancer | « on est obligé de faire retour pour essayer les autres » (21 novembre) |
| `portes` | dans les Réglages libres, chaque porte de chaque rubrique (et des pages qu'elle ouvre) mène à un écran, dit ce qu'elle ferait, ou ramène | « n'importe quelle porte dans la page réglage » (21 novembre) |
| `muets` | chaque bouton des écrans d'essai répond | `CLAUDE.md` §3 bis, 2 quater |
| `chrono` | à chaque étape, le guide est là, opaque et immobile, en moins de 600 ms, processeur ralenti quatre fois | « on reste sur la page plusieurs secondes » (21 novembre) : 3 546 ms pendant que la fiche du client s'écrivait seule |

**Chaque contrôle a été vu rouge** sur le défaut qu'il tient, avant la
correction. Le `chrono` a même dû être repris : sa première version comptait
comme présent un guide qui commençait à s'effacer, et passait au vert sur la
visite fautive.

**Ce qu'il ne voit pas : Safari sur un iPhone.** Ce poste n'a que Chromium.
La visite pose `cursor: pointer` sur chaque cible, sans quoi Safari n'envoie
aucun appui hors d'un bouton.

## Refaire les écrans ajoutés le 21 novembre

La fiche de sécurité (son croquis, l'éditeur, la fiche signée, le PDF), les
véhicules et leur rappel sur l'accueil, et chaque porte des Réglages : ils se
refont d'ici, **sur une base de démonstration neuve, donc sur son « oui »**
(l'appli et une base tournent, `CLAUDE.md` §5).

```bash
source scripts/monter-base-locale.sh
DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed
NODE_ENV=production npx next build && NODE_ENV=production npx next start -p 3001   # avec ATLAS_PROFIL=banc, AUTH_TRUST_HOST=true, REDIS_URL, LLM_PROVIDER=dev
npx tsx appli/scripts/visite-guidee/donnees.ts avant                 # l'équipe, M. Lefèvre et sa fiche, les véhicules : tout inventé
ATLAS_ADRESSE=http://localhost:3001 node appli/scripts/visite-guidee/figer-neufs.mjs /tmp/neufs   # fige, et signe la fiche entre le croquis et la fiche signée
node appli/scripts/visite-guidee/composer-neufs.mjs /tmp/neufs       # pose écrans, styles et étapes ; se rejoue sans rien doubler
node appli/scripts/visite-guidee/parcourir.mjs                       # puis on vérifie
```

| | ce qu'il fait |
|---|---|
| `donnees.ts` | `avant` : Paul, Kévin, Hugo ; le chantier de M. Lefèvre le 25 novembre ; sa fiche remplie, croquis compris ; trois véhicules « DE-…-MO ». `signer` : la signature du chef, les lectures de l'équipe, « plan de prévention : oui » (qui fait paraître « Envoyer au client »), signée le 25 à 7 h 45 |
| `figer-neufs.mjs` | fige les écrans, les pages d'un PDF en images, et suit les portes des Réglages sur trois profondeurs |
| `composer-neufs.mjs` | ajoute les règles de style qui manquent, pose chaque écran **sur une seule ligne**, et les étapes (`neuf`) |

**Les pièges payés en les faisant :**

- un écran sur plusieurs lignes (« Mon message au client » en porte 23) laissait,
  à la recomposition ligne par ligne, ses restes hors de toute enveloppe : une
  barre « Réglages » posée par-dessus toute la visite. Chaque écran tient sur une
  ligne, et `parcourir.mjs` refuse le moindre morceau échappé ;
- les réponses d'après la signature (lectures, plan de prévention) ne
  s'écrivent pas avec la fiche : seulement après, par `completerLaFicheSignee` ;
- la flèche de retour d'un écran figé pointe vers la page vue juste avant (le
  PDF, pour les véhicules) : la visite ne la suit pas, elle ramène à l'écran d'avant.

**Ce qui manque toujours : le script qui FIGE les 95 écrans d'origine** de la
visite (`scripts/planche-figee/visite-guidee/`, jamais enregistré, voir
`docs/visite-guidee.md`).
