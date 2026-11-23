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
| `visite` | chaque étape mène à la suivante ; la cible n'est jamais sous le guide ni hors de l'écran ; rien ne déborde ; les 19 rubriques des Réglages s'ouvrent et reviennent ; faire défiler replie le guide ; l'anneau doré vit dans le plan de son bouton (la page, ou le calque fixe pour une feuille fixe), et son halo ne sort jamais de l'écran sans être coupé par `overflow: hidden` ; la croix quitte à toute étape, après « Quitter la visite ? » ; une case figée touchée ne prend pas la main (l'iPhone zoomerait) | « la petite barre noire cache les informations » (21 novembre) ; « la zone n'est pas vraiment centrée par rapport au bouton » (22 novembre, sur son iPhone) ; « la page de réglage se balade de droite à gauche » (22 novembre) |
| `essais` | les boutons à essayer du devis et de la facture s'enchaînent sans Retour ; Suivant fait avancer ; ceux des travaux en plus de la facture s'essaient, Annuler ou Retirer y ramène, et ce qu'un essai posé doit montrer (`voir`) est à l'écran en arrivant | « on est obligé de faire retour pour essayer les autres » (21 novembre) ; « je peux pas ajouter un travail ou un règlement reçu » (22 novembre) |
| `portes` | dans les Réglages libres, chaque porte de chaque rubrique (et des pages qu'elle ouvre) mène à un écran, dit ce qu'elle ferait, ou ramène | « n'importe quelle porte dans la page réglage » (21 novembre) |
| `muets` | chaque bouton des écrans d'essai répond | `CLAUDE.md` §3 bis, 2 quater. **Il compte un guide qui tremble comme une réponse** : il n'a donc pas vu « Ajouter un travail » muet. Un bouton qui doit OUVRIR quelque chose se tient dans `essais` |
| `chrono` | à chaque étape, le guide est là, opaque et immobile, en moins de 600 ms, processeur ralenti quatre fois | « on reste sur la page plusieurs secondes » (21 novembre) : 3 546 ms pendant que la fiche du client s'écrivait seule |

**Chaque contrôle a été vu rouge** sur le défaut qu'il tient, avant la
correction. Le `chrono` a même dû être repris : sa première version comptait
comme présent un guide qui commençait à s'effacer, et passait au vert sur la
visite fautive.

**Ce qu'il ne voit pas : Safari sur un iPhone.** Ce poste n'a que Chromium.
La visite pose `cursor: pointer` sur chaque cible, sans quoi Safari n'envoie
aucun appui hors d'un bouton. Et Safari 26 décale ses éléments fixes de
quelques points quand sa barre bouge (WebKit 297779) : un anneau posé dans un
calque fixe au-dessus d'un bouton de la page y tombait à côté. Le contrôle
`visite` tient la règle (l'anneau dans le plan de son bouton), pas le décalage
lui-même, que Chromium ne fait pas.

## Refaire les écrans ajoutés les 21 et 22 novembre

L'aperçu du devis et ses coupures (une nouvelle page, un espace), la fiche de
sécurité (son croquis, l'éditeur, la fiche signée, le PDF), les véhicules et
leur rappel sur l'accueil, chaque porte des Réglages, et les travaux en plus de
la facture (un travail, la main d'œuvre, une TVA, un règlement) : ils se
refont d'ici, **sur une base de démonstration neuve, donc sur son « oui »**
(l'appli et une base tournent, `CLAUDE.md` §5).

```bash
source scripts/monter-base-locale.sh
DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed
NODE_ENV=production npx next build && NODE_ENV=production npx next start -p 3001   # avec ATLAS_PROFIL=banc, AUTH_TRUST_HOST=true, REDIS_URL, LLM_PROVIDER=dev
npx tsx appli/scripts/visite-guidee/donnees.ts avant                 # l'équipe, M. Lefèvre et sa fiche, les véhicules : tout inventé
ATLAS_ADRESSE=http://localhost:3001 node appli/scripts/visite-guidee/figer-neufs.mjs /tmp/neufs   # fige, et joue les autres phases de donnees.ts là où l'appli les attend
node appli/scripts/visite-guidee/composer-neufs.mjs /tmp/neufs       # pose écrans, styles et étapes ; se rejoue sans rien doubler
node appli/scripts/visite-guidee/parcourir.mjs                       # puis on vérifie
```

| | ce qu'il fait |
|---|---|
| `donnees.ts` | `avant` : Paul, Kévin, Hugo ; le chantier de M. Lefèvre le 25 novembre et ses trois prix (le devis, c'est l'appli qui le fait en ouvrant sa page) ; les compteurs à 2026-000004 et F2026-000002 ; sa fiche remplie, croquis compris ; trois véhicules « DE-…-MO ». `apercu` : le devis daté du 21 et titré « Entretien du jardin », le chantier sans durée (elle se choisit avec la date) ; `apres-apercu` la rend. `signer` : la signature du chef, les lectures de l'équipe, « plan de prévention : oui » (qui fait paraître « Envoyer au client »), signée le 25 à 7 h 45. `facturer` : le devis envoyé, le chantier au 18 ; `dater-facture` : émise le 21, à régler avant le 21 décembre |
| `figer-neufs.mjs` | fige les écrans, les pages d'un PDF en images, et suit les portes des Réglages sur trois profondeurs. Chaque essai de la facture repart de l'écran nu : ce qu'il a posé se retire |
| `composer-neufs.mjs` | ajoute les règles de style qui manquent, pose chaque écran **sur une seule ligne**, les étapes (`neuf`) et les essais des travaux en plus (`neuf`, `depuis`, et `voir` : ce que l'écran posé montre en arrivant). Une page de PDF répétée d'un écran à l'autre ne s'écrit qu'une fois (`data-visite-image`) ; le guide la recopie au chargement (`data-visite-meme`) |

**Les pièges payés en les faisant :**

- un écran sur plusieurs lignes (« Mon message au client » en porte 23) laissait,
  à la recomposition ligne par ligne, ses restes hors de toute enveloppe : une
  barre « Réglages » posée par-dessus toute la visite. Chaque écran tient sur une
  ligne, et `parcourir.mjs` refuse le moindre morceau échappé ;
- les réponses d'après la signature (lectures, plan de prévention) ne
  s'écrivent pas avec la fiche : seulement après, par `completerLaFicheSignee` ;
- la flèche de retour d'un écran figé pointe vers la page vue juste avant (le
  PDF, pour les véhicules) : la visite ne la suit pas, elle ramène à l'écran d'avant ;
- un règlement reçu dont on change le moyen, la date et le montant d'affilée
  garde seulement le dernier : chaque champ renvoie la ligne entière telle que
  l'écran l'a reçue. Le script laisse chaque champ s'enregistrer avant le
  suivant. C'est un défaut de l'appli (`TODO.md`) ;
- `figer.mjs` ne garde pas le choix d'une liste déroulante qui n'a pas été
  relue depuis le serveur : chaque essai se fige après avoir relu sa page.

**Et dans le guide lui-même** : l'anneau posé dans la page (`.v-plan`) ne doit
jamais la rallonger. Un anneau éteint reste placé où il était ; sans borne, il
agrandissait l'écran suivant, et la visite calait sa cible sur une page qui
n'existait plus. Le plan prend la hauteur de l'écran montré (`borner`), et coupe
par `overflow: hidden` : avec `overflow: clip`, Safari laissait le halo d'un
anneau collé au bord élargir toute la page, ce que Chromium ne montre pas.

**Ce qui manque toujours : le script qui FIGE les 95 écrans d'origine** de la
visite (`scripts/planche-figee/visite-guidee/`, jamais enregistré, voir
`docs/visite-guidee.md`).
