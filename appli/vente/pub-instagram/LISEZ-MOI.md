# La pub Instagram de Cause

Sa demande du 16 novembre 2026 : *« une pub pour Instagram pour lancer mon
application, vendeuse, assez directe, pas plus d'une minute : le devis en
dictant, la mise au planning par l'acceptation du client, puis la facture, la
TVA et l'inscription pour le bilan comptable »*, et *« utiliser les vraies
pages de l'application, n'invente aucune page »*.

Sa correction du 17 novembre, devant le premier montage : l'appli s'appelle
**Cause**, plus Atlas, et *« il faut rentrer beaucoup plus vite dans le vif du
sujet : il faut directement qu'ils puissent voir ce qu'il y a dans
l'application et ce qui va les aider »*.

Puis, devant ce second montage : *« au tout début de la vidéo, une petite
phrase d'accroche pour les artisans qui défile très rapidement, enfin qu'on
puisse la lire quand même. Et ensuite la première page de l'application, où on
cliquerait sur créer le devis pour voir apparaître la fiche client, et là où
tu dictes ton devis. »*

Une vidéo verticale de 36 secondes, 1080 × 1920, faite avec HyperFrames
(`.claude/skills/hyperframes`) : `cause-pub-instagram.mp4`, dans ce dossier.
Le montage retenu et ceux qui ne le sont pas sont dans `STORYLINES.md`, la
fiche du film dans `SPEC.md`, la relecture dans `REVIEW.md`.

## Ce que le film montre

Une accroche d'une seconde et demie, puis l'appli : chaque plan dit un
bénéfice sur l'écran qui le prouve.

| Temps | Scène | Ce qu'on lit | L'écran de l'appli |
|---|---|---|---|
| 0 à 1,6 s | `accroche` | Artisans, marre de la paperasse ? | aucun |
| 1,6 à 5,7 s | `dictez` | Dictez vos devis, sur le chantier. | l'accueil, « Créer un devis », la fiche client qui monte, puis remplie |
| 5,7 à 9,3 s | `dictez` | la phrase dictée | le micro et son chrono |
| 9,3 à 13,7 s | `dictez` | Cause écrit le devis, avec vos prix. | le devis, sa ligne, son total |
| 13,7 à 19 s | `client` | Votre client accepte sur son téléphone. | la page que reçoit le client |
| 19 à 22,9 s | `planning` | Le chantier se pose au planning. | le planning du mois, la journée |
| 22,9 à 26,4 s | `encaissez` | La facture reprend le devis. | la facture |
| 26,4 à 31,6 s | `encaissez` | La TVA du mois, déjà calculée. Pour votre comptable, tout est justifié. | Terminés, ses deux cartes en gros plan |
| 31,6 à 35,8 s | `fin` | Cause, Le logiciel des artisans, Essayer 15 jours gratuits | aucun |

Les phrases sont celles du site de vente (`appli/vente/chapitres-6.html`) ;
l'accroche est la sienne. Le nom de l'appli s'écrit à deux endroits :
`compositions/dictez.html` et `compositions/fin.html`.

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
  Terminés vaut bien 143,70 €. Le tournage filme aussi la feuille d'envoi et
  ses dates, que le montage n'emploie pas.
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
for f in ouverture micro devis client planning facture; do
  cp /tmp/tournage-atlas/$f.mp4 /tmp/tournage-atlas/$f.json appli/vente/pub-instagram/assets/films/
done
cp /tmp/tournage-atlas/termines.png appli/vente/pub-instagram/assets/films/
```

`tourner.mjs --depuis <étape>` reprend en route ; chaque prise écrit ses
repères (`assets/films/<prise>.json`), sur lesquels le montage cale ses coupes.

## Refaire le rendu

```bash
cd appli/vente/pub-instagram
npx hyperframes check --json
npx hyperframes snapshot --at 0.5,2.4,3.25,4.75,6.2,8.4,12.6,17.8,20.5,28.1,29.6,34.5
npx hyperframes render --quality delivery -o cause-pub-instagram.mp4
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
