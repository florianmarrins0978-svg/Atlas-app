# La pub Instagram d'Atlas

Sa demande du 16 novembre 2026 : *« une pub pour Instagram pour lancer mon
application, vendeuse, assez directe, pas plus d'une minute : le devis en
dictant, la mise au planning par l'acceptation du client, puis la facture, la
TVA et l'inscription pour le bilan comptable »*, et *« utiliser les vraies
pages de l'application, n'invente aucune page »*.

Une vidéo verticale de 51 secondes, 1080 × 1920, faite avec HyperFrames
(`.claude/skills/hyperframes`) : `atlas-pub-instagram.mp4`, dans ce dossier. Le scénario retenu et les deux écartés sont
dans `STORYLINES.md`, la fiche du film dans `SPEC.md`, la relecture dans
`REVIEW.md`.

## Ce que le film montre

| Temps | Scène | Ce qu'on lit | L'écran de l'appli |
|---|---|---|---|
| 0 à 2,4 s | `accroche` | Artisans, marre de la paperasse ? | aucun |
| 2,4 à 8,4 s | `corvees` | les trois corvées, barrées par « Atlas s'en occupe. » | aucun |
| 8,4 à 19 s | `dictez` | Dictez. | l'accueil, la fiche client, le micro et son chrono, le devis |
| 19 à 28,4 s | `envoyez` | Envoyez. | la feuille d'envoi et ses dates, la page que reçoit le client |
| 28,4 à 35 s | `planifiez` | Planifiez. | « Devis accepté » à l'accueil, le planning du mois, la journée |
| 35 à 44,4 s | `encaissez` | Encaissez. | la facture, puis Terminés : Ma TVA à déclarer, Pour mon comptable |
| 44,4 à 50,7 s | `fin` | Vous restez sur le chantier. Atlas, Essayer 15 jours gratuits | aucun |

Les phrases sont celles du site de vente (`appli/vente/chapitres-6.html`).
L'accroche est la sienne : devant « Vous êtes artisan. Pas secrétaire. », il a
répondu que c'était discriminant et demandé « marre de la paperasse ».

## Rien n'est dessiné

Chaque écran est l'appli du 16 novembre 2026, filmée image par image sur une
base d'essai du nuage (son accord du jour). Les films sont dans
`assets/films/`, les scripts dans `tournage/`.

- **L'entreprise** est celle du site de vente, Les Jardins de Valmorin
  (commune inventée, numéros impossibles à attribuer) : `tournage/scene.sql`
  pose son identité, ses quatre tarifs et un mois de novembre déjà habité.
- **Le chantier Lemaire passe par les vrais boutons** (`tournage/tourner.mjs`) :
  fiche client, note vocale, devis, dates proposées, accord du client sur sa
  page, facture créée, acquittée et envoyée. La TVA de novembre affichée par
  Terminés vaut bien 143,70 €.
- **La caméra** (`tournage/_prise.mjs`) fige l'horloge de la page et l'avance
  d'une image à la fois, animations de l'appli comprises : trente images par
  seconde, sans une saccade. C'est la méthode des films du site de vente.

### Ce qui n'est pas vérifiable ici

Le conteneur n'a pas de clé d'IA : la dictée n'y rend pas les lignes du devis.
Le geste de la note vocale est donc filmé pour de vrai (micro simulé par le
navigateur, le vrai chrono de l'appli), puis le devis est écrit à la main par
les vrais champs. Sur son espace, l'IA écrit ces lignes. La phrase « On arrache
l'ancienne haie de thuyas sur douze mètres. » est un titre du film, pas un
écran.

Tout se joue un lundi 16 novembre : le client retient le jour même. C'est ce
qui garde la facture, la TVA et Terminés d'accord entre eux sans toucher à
l'horloge du serveur.

## Refaire les films

L'appli doit tourner, version construite, sur une base d'essai (son accord
d'abord : `CLAUDE.md` §5).

```bash
source scripts/monter-base-locale.sh
NODE_ENV=production node node_modules/next/dist/bin/next build
ATLAS_PROFIL=banc AUTH_TRUST_HOST=true TRANSCRIPTION_PROVIDER=essai \
  REDIS_URL=redis://localhost:6379 NODE_ENV=production \
  node node_modules/next/dist/bin/next start -p 3000 &

bash appli/vente/pub-instagram/tournage/poser-la-scene.sh
TOURNAGE_SORTIE=/tmp/tournage-atlas node appli/vente/pub-instagram/tournage/tourner.mjs
cp /tmp/tournage-atlas/*.mp4 /tmp/tournage-atlas/termines.png appli/vente/pub-instagram/assets/films/
```

`tourner.mjs --depuis <étape>` reprend en route ; chaque prise écrit ses
repères (`assets/films/<prise>.json`), sur lesquels le montage cale ses coupes.

## Refaire le rendu

```bash
cd appli/vente/pub-instagram
npx hyperframes check --json
npx hyperframes snapshot --at 1.5,13,24,31,40,49
npx hyperframes render --quality delivery -o atlas-pub-instagram.mp4
```

GSAP est posé dans `assets/` : le réseau du nuage refuse son CDN. Les polices
sont celles du site de vente (Instrument Serif, Hanken Grotesk), dans
`assets/fonts/`.

## Le son

Aucune musique n'a pu être prise ici : le catalogue demande un compte, et le
skill interdit d'en écrire une à l'aveugle. La vidéo est muette. Elle se
publie avec une musique choisie dans Instagram ; pour une publicité payante,
dans la bibliothèque de sons que Meta ouvre aux annonceurs.

## Les marges d'Instagram

Tout ce qui se lit tient entre 270 et 1248 px de haut : au-dessus, Instagram
pose le nom du compte ; en dessous, la légende et le bouton. Le bas du
téléphone passe sous cet habillage, exprès.
